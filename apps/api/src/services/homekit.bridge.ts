import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import {
  Accessory,
  Categories,
  Characteristic,
  CharacteristicValue,
  HAPStorage,
  Service,
  uuid
} from 'hap-nodejs';
import { prisma } from '../lib/prisma';

const configDir = fs.existsSync('/app/config')
  ? '/app/config'
  : fs.existsSync(path.resolve(process.cwd(), 'config'))
    ? path.resolve(process.cwd(), 'config')
    : path.resolve(process.cwd(), '..', '..', 'config');

const persistDir = path.join(configDir, 'homekit-persist');
if (!fs.existsSync(persistDir)) {
  fs.mkdirSync(persistDir, { recursive: true });
}
HAPStorage.setCustomStoragePath(persistDir);

const configFilePath = path.join(configDir, 'homekit_config.json');

interface HomeKitConfig {
  enabled: boolean;
  name: string;
  pincode: string;
  username: string;
  port: number;
}

function loadConfig(): HomeKitConfig {
  const defaultConfig: HomeKitConfig = {
    enabled: true,
    name: 'MOSA Smart Bridge',
    pincode: '202-02-021',
    username: 'CC:22:3D:E3:CE:F6',
    port: 51826
  };
  try {
    if (fs.existsSync(configFilePath)) {
      const data = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
      return { ...defaultConfig, ...data };
    }
  } catch (e) {
    console.warn('[HomeKit Bridge] Error reading config file, using default:', e);
  }
  return defaultConfig;
}

function saveConfig(cfg: HomeKitConfig) {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('[HomeKit Bridge] Error saving config file:', e);
  }
}

let activeBridge: Accessory | null = null;
const bridgedAccessories: Map<string, Accessory> = new Map();
let mqttServiceInstance: any = null;

export function setHomeKitMqttService(mqtt: any) {
  mqttServiceInstance = mqtt;
}

/**
 * Initializes and starts the native Apple HomeKit HAP Bridge
 */
export async function initHomeKitBridge(mqttService?: any) {
  if (mqttService) mqttServiceInstance = mqttService;
  const cfg = loadConfig();
  if (!cfg.enabled) {
    console.log('[HomeKit Bridge] Bridge is currently disabled in config.');
    return;
  }

  try {
    console.log('[HomeKit Bridge] 🍏 Initializing Native Apple HomeKit HAP Bridge...');
    const bridgeUuid = uuid.generate('mosa.homekit.bridge.root');
    activeBridge = new Accessory(cfg.name, bridgeUuid);

    activeBridge
      .getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'MOSA Smart Home')
      .setCharacteristic(Characteristic.Model, 'MOSA Enterprise Hub')
      .setCharacteristic(Characteristic.SerialNumber, 'MOSA-HAP-01')
      .setCharacteristic(Characteristic.FirmwareRevision, '3.0.0');

    // Load active devices from PostgreSQL
    const devices = await prisma.device.findMany({
      where: { deletedAt: null },
      include: { node: true }
    });

    console.log(`[HomeKit Bridge] Found ${devices.length} registered devices to bridge to Apple Home.`);

    for (const dev of devices) {
      addDeviceToBridge(dev);
    }

    // Publish the bridge on LAN (port 51826)
    activeBridge.publish({
      username: cfg.username,
      pincode: cfg.pincode,
      port: cfg.port,
      category: Categories.BRIDGE
    });

    const setupUri = activeBridge.setupURI();
    console.log(`[HomeKit Bridge] 🍏 Apple HomeKit Bridge ACTIVE! Port: ${cfg.port}, PIN: ${cfg.pincode}`);
    console.log(`[HomeKit Bridge] 📲 Pairing URI: ${setupUri}`);
  } catch (error) {
    console.error('[HomeKit Bridge] ❌ Failed to start Apple HomeKit Bridge:', error);
  }
}

function addDeviceToBridge(dev: any) {
  if (!activeBridge) return;
  const devUuid = uuid.generate(`mosa.device.${dev.id}`);
  const acc = new Accessory(dev.name || `Device ${dev.pin}`, devUuid);

  acc
    .getService(Service.AccessoryInformation)!
    .setCharacteristic(Characteristic.Manufacturer, 'MOSA Smart Home')
    .setCharacteristic(Characteristic.Model, dev.type || 'Light')
    .setCharacteristic(Characteristic.SerialNumber, dev.id)
    .setCharacteristic(Characteristic.FirmwareRevision, '3.0.0');

  const devType = (dev.type || 'light').toLowerCase();
  const stateObj = (dev.state as any) || {};
  let isCurrentlyOn = stateObj.isOn ?? (stateObj.state === 'ON');

  if (devType.includes('temp') || devType.includes('sensor')) {
    // Temperature Sensor
    const tempService = acc.addService(Service.TemperatureSensor, dev.name);
    tempService.getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(async () => {
        const cached = await getCachedDeviceState(dev);
        return cached?.temperature || 24.0;
      });

    // Humidity Sensor
    const humService = acc.addService(Service.HumiditySensor, `${dev.name} Humidity`);
    humService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(async () => {
        const cached = await getCachedDeviceState(dev);
        return cached?.humidity || 45.0;
      });
  } else {
    // Lightbulb or Switch
    const serviceType = devType.includes('switch') || devType.includes('outlet') ? Service.Switch : Service.Lightbulb;
    const s = acc.addService(serviceType, dev.name);

    s.getCharacteristic(Characteristic.On)
      .onGet(async () => {
        const cached = await getCachedDeviceState(dev);
        if (cached && typeof cached.isOn === 'boolean') {
          return cached.isOn;
        }
        return isCurrentlyOn;
      })
      .onSet(async (value: CharacteristicValue) => {
        const turnOn = Boolean(value);
        console.log(`[HomeKit 🍏 -> Device] User toggled '${dev.name}' (Pin ${dev.pin}) to ${turnOn ? 'ON' : 'OFF'}`);
        isCurrentlyOn = turnOn;
        await sendMosaDeviceCommand(dev, turnOn ? 'ON' : 'OFF');
      });

    // Dimmer / Brightness support
    if (devType.includes('dimmer')) {
      s.addCharacteristic(Characteristic.Brightness)
        .onGet(async () => {
          const cached = await getCachedDeviceState(dev);
          return cached?.pwmValue || 100;
        })
        .onSet(async (value: CharacteristicValue) => {
          const brightness = Number(value);
          console.log(`[HomeKit 🍏 -> Device] Dimmer '${dev.name}' set brightness to ${brightness}%`);
          await sendMosaDeviceCommand(dev, isCurrentlyOn ? 'ON' : 'OFF', brightness);
        });
    }
  }

  try {
    activeBridge.addBridgedAccessory(acc);
    bridgedAccessories.set(dev.id, acc);
  } catch (e) {
    console.warn(`[HomeKit Bridge] Could not add accessory ${dev.name}:`, e);
  }
}

async function getCachedDeviceState(dev: any) {
  try {
    const { redisClient } = await import('../server');
    const homeId = dev.homeId || 'home-1';
    const boardId = dev.node?.name || dev.nodeId;
    if (boardId && redisClient) {
      const raw = await redisClient.hget(`mosa:home:${homeId}:device_state:${boardId}`, 'latest');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.devices)) {
          const match = parsed.devices.find((d: any) => d.pin === dev.pin || d.id === dev.pin);
          if (match) return match;
        }
      }
    }
  } catch (e) {
    // fallback
  }
  return null;
}

async function sendMosaDeviceCommand(dev: any, state: 'ON' | 'OFF', pwmValue?: number) {
  const homeId = dev.homeId || 'home-1';
  const boardId = dev.node?.name || dev.nodeId;
  if (!boardId) return;

  const topic = `mosa/${homeId}/device/${boardId}/command`;
  const payload = {
    action: 'SET_STATE',
    pin: dev.pin,
    state: state,
    isOn: state === 'ON',
    pwmValue: pwmValue !== undefined ? pwmValue : 100,
    timestamp: Date.now()
  };

  if (mqttServiceInstance?.client?.connected) {
    mqttServiceInstance.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  // Update local DB
  try {
    const sObj = (dev.state as any) || {};
    await prisma.device.update({
      where: { id: dev.id },
      data: {
        state: { ...sObj, state, isOn: state === 'ON', pwmValue: pwmValue ?? sObj.pwmValue }
      }
    });
  } catch (e) {
    console.error('[HomeKit Bridge] DB update failed:', e);
  }
}

/**
 * Updates HomeKit characteristic when hardware state changes (Physical switch or MQTT update)
 */
export function syncHomeKitDeviceState(pin: number, boardId: string, state: 'ON' | 'OFF', temp?: number, hum?: number) {
  if (!activeBridge) return;
  for (const [devId, acc] of bridgedAccessories.entries()) {
    const s = acc.getService(Service.Lightbulb) || acc.getService(Service.Switch);
    if (s) {
      const char = s.getCharacteristic(Characteristic.On);
      if (char) {
        char.updateValue(state === 'ON');
      }
    }
    if (temp !== undefined) {
      const tService = acc.getService(Service.TemperatureSensor);
      if (tService) {
        tService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(temp);
      }
    }
    if (hum !== undefined) {
      const hService = acc.getService(Service.HumiditySensor);
      if (hService) {
        hService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(hum);
      }
    }
  }
}

/**
 * Returns HomeKit Bridge status, setup URI, and generated QR Code for frontend display
 */
export async function getHomeKitStatus() {
  const cfg = loadConfig();
  let qrCodeDataUrl = '';
  let setupUri = '';

  if (activeBridge) {
    setupUri = activeBridge.setupURI();
    try {
      qrCodeDataUrl = await QRCode.toDataURL(setupUri, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (e) {
      console.error('[HomeKit] QR generate error:', e);
    }
  }

  return {
    enabled: cfg.enabled,
    name: cfg.name,
    pincode: cfg.pincode,
    username: cfg.username,
    port: cfg.port,
    active: !!activeBridge,
    accessoriesCount: bridgedAccessories.size,
    setupUri,
    qrCodeDataUrl,
    noHubRequired: true,
    directPairingSupported: true
  };
}

/**
 * Resets HomeKit bridge pairing (generates new MAC and resets persist)
 */
export async function resetHomeKitBridge() {
  const cfg = loadConfig();
  const randHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
  cfg.username = `CC:22:${randHex()}:${randHex()}:${randHex()}:${randHex()}`;
  saveConfig(cfg);

  try {
    const files = fs.readdirSync(persistDir);
    for (const file of files) {
      fs.unlinkSync(path.join(persistDir, file));
    }
  } catch (e) {
    console.warn('[HomeKit Bridge] Error clearing persist dir:', e);
  }

  if (activeBridge) {
    try {
      activeBridge.unpublish();
    } catch (e) {}
    activeBridge = null;
    bridgedAccessories.clear();
  }

  await initHomeKitBridge();
  return getHomeKitStatus();
}
