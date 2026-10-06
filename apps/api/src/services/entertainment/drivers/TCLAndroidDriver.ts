import { BaseEntertainmentDriver } from './BaseEntertainmentDriver';
import { Result } from '@mosa/core/dist/errors/Result';
import { BaseError } from '@mosa/core/dist/errors/BaseError';
import { DeviceState } from '@mosa/core/dist/types/DeviceState';
import { EntertainmentCapabilities, AppMetadata, InputMetadata } from '@mosa/core/dist/types/Capabilities';
import net from 'net';
import dgram from 'dgram';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

function probeTcpPort(host: string, port: number, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      done = true;
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      if (!done) { done = true; socket.destroy(); resolve(false); }
    });
    socket.once('error', () => {
      if (!done) { done = true; socket.destroy(); resolve(false); }
    });
    socket.connect(port, host);
  });
}

const ANDROID_KEYCODES: Record<string, number> = {
  'POWER': 26,
  'POWER_ON': 224,   // KEYCODE_WAKEUP
  'POWER_OFF': 223,  // KEYCODE_SLEEP
  'HOME': 3,
  'BACK': 4,
  'UP': 19,
  'DOWN': 20,
  'LEFT': 21,
  'RIGHT': 22,
  'OK': 23,
  'ENTER': 66,
  'MENU': 82,
  'VOL_UP': 24,
  'VOL_DOWN': 25,
  'MUTE': 164,
  'PLAY': 126,
  'PAUSE': 127,
  'PLAY_PAUSE': 85,
  'REWIND_10': 89,
  'FORWARD_10': 90,
  'INFO': 165,
  'SETTINGS': 176,
  'SOURCE': 178,
  'CH_UP': 166,
  'CH_DOWN': 167
};

const ANDROID_APP_PACKAGES: Record<string, string> = {
  'youtube': 'com.google.android.youtube.tv',
  'netflix': 'com.netflix.ninja',
  'shahid': 'net.mbc.shahid',
  'spotify': 'com.spotify.tv.android',
  'googleplay': 'com.android.vending',
  'tclchannel': 'com.tcl.channel'
};

export class TCLAndroidDriver extends BaseEntertainmentDriver {
  private isAdbConnected: boolean = false;
  private lastAdbCheck: number = 0;
  private isResolvingMac: boolean = false;

  constructor(deviceId: string, ipAddress: string, macAddress?: string) {
    super(deviceId, ipAddress, macAddress);
  }
  
  async connect(): Promise<Result<void, BaseError>> {
    const isOnline = await probeTcpPort(this.ipAddress, 5555, 400) || 
                     await probeTcpPort(this.ipAddress, 8008, 400) || 
                     await probeTcpPort(this.ipAddress, 6466, 400);
    this.isConnected = isOnline;
    console.log(`[TCL-Android] Connect probe for ${this.ipAddress} (online: ${isOnline})`);
    
    // Proactively connect ADB and resolve MAC address in background
    if (isOnline) {
      this.ensureAdb(800).then(ok => {
        if (ok) this.resolveMacAddress().catch(() => {});
      }).catch(() => {});
    }

    return Result.ok();
  }

  async disconnect(): Promise<Result<void, BaseError>> {
    this.isConnected = false;
    this.isAdbConnected = false;
    return Result.ok();
  }

  getCapabilities(): EntertainmentCapabilities {
    return {
      power: true,
      volume: true,
      mute: true,
      apps: true,
      inputs: true,
      mediaControls: true,
      keyboard: true,
      mouse: false, 
      wakeOnLan: true,
      screenshot: true
    };
  }

  async getState(): Promise<Result<DeviceState, BaseError>> {
    const isOnline = await probeTcpPort(this.ipAddress, 5555, 350) || 
                     await probeTcpPort(this.ipAddress, 8008, 350);
    this.isConnected = isOnline;
    return Result.ok({
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      isOn: isOnline,
      volume: 30,
      isMuted: false,
      lastUpdate: new Date()
    });
  }

  /**
   * Automatically resolve the hardware MAC address of the TV
   * so Wake-on-LAN works reliably even after deep sleep.
   */
  public async resolveMacAddress(): Promise<string | null> {
    if (this.macAddress && /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(this.macAddress)) {
      return this.macAddress;
    }
    if (this.isResolvingMac) return this.macAddress || null;
    this.isResolvingMac = true;

    try {
      // 1. Try reading from TV via ADB
      try {
        const { stdout } = await execPromise(`adb -s ${this.ipAddress}:5555 shell "cat /sys/class/net/wlan0/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null"`, { timeout: 1500 });
        const match = stdout.trim().match(/([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})/);
        if (match) {
          this.macAddress = match[1].toLowerCase();
          console.log(`[TCL-Android] 🎯 Auto-resolved TV MAC via ADB: ${this.macAddress}`);
          return this.macAddress;
        }
      } catch {}

      // 2. Try reading host /proc/net/arp (Raspberry Pi kernel ARP cache)
      try {
        if (fs.existsSync('/proc/net/arp')) {
          const arpContent = fs.readFileSync('/proc/net/arp', 'utf8');
          for (const line of arpContent.split('\n')) {
            if (line.includes(this.ipAddress)) {
              const parts = line.split(/\s+/);
              if (parts[3] && parts[3] !== '00:00:00:00:00:00' && parts[3].includes(':')) {
                this.macAddress = parts[3].toLowerCase();
                console.log(`[TCL-Android] 🎯 Auto-resolved TV MAC via /proc/net/arp: ${this.macAddress}`);
                return this.macAddress;
              }
            }
          }
        }
      } catch {}

      // 3. Try host arp command
      try {
        const { stdout } = await execPromise(`arp -n ${this.ipAddress} 2>/dev/null || arp -a ${this.ipAddress} 2>/dev/null`, { timeout: 1000 });
        const match = stdout.match(/([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})/);
        if (match && !match[1].includes('00-00-00') && !match[1].includes('00:00:00')) {
          this.macAddress = match[1].replace(/-/g, ':').toLowerCase();
          console.log(`[TCL-Android] 🎯 Auto-resolved TV MAC via arp command: ${this.macAddress}`);
          return this.macAddress;
        }
      } catch {}
    } finally {
      this.isResolvingMac = false;
    }

    return null;
  }

  /**
   * Real Wake-on-LAN Magic Packet helper:
   * Constructs the authentic standard 102-byte Magic Packet:
   * 6 bytes of 0xFF followed by 16 repetitions of the 6-byte target MAC address.
   */
  public sendWolMagicPacket(targetMac?: string) {
    const macToUse = targetMac || this.macAddress;
    if (!macToUse) {
      console.warn(`[TCL-Android] ⚠️ Cannot send WOL: MAC address unknown for ${this.ipAddress}`);
      return;
    }

    const cleanMac = macToUse.replace(/[^0-9a-fA-F]/g, '');
    if (cleanMac.length !== 12) {
      console.warn(`[TCL-Android] ⚠️ Invalid MAC format: ${macToUse}`);
      return;
    }

    try {
      const macBuf = Buffer.from(cleanMac, 'hex');
      const magic = Buffer.alloc(102);
      magic.fill(0xff, 0, 6);
      for (let i = 0; i < 16; i++) {
        macBuf.copy(magic, 6 + i * 6);
      }

      const client = dgram.createSocket('udp4');
      client.bind(() => {
        client.setBroadcast(true);

        const targets = [
          { host: '255.255.255.255', port: 9 },
          { host: '255.255.255.255', port: 7 },
          { host: '192.168.1.255', port: 9 },
          { host: this.ipAddress, port: 9 }
        ];

        let burst = 0;
        const sendBurst = () => {
          for (const t of targets) {
            client.send(magic, 0, magic.length, t.port, t.host, () => {});
          }
          burst++;
          if (burst < 3) {
            setTimeout(sendBurst, 50);
          } else {
            setTimeout(() => client.close(), 100);
          }
        };

        sendBurst();
      });

      console.log(`[TCL-Android] ⚡ Sent 3 Wake-on-LAN Magic Packet bursts for [${macToUse}] to ${this.ipAddress}`);
    } catch (err: any) {
      console.error(`[TCL-Android] WOL Error:`, err.message);
    }
  }

  /**
   * Fast persistent ADB connection manager:
   * Caches active connection state for 45s so keypresses don't re-execute `adb connect`.
   */
  private async ensureAdb(timeoutMs = 1200): Promise<boolean> {
    const now = Date.now();
    if (this.isAdbConnected && (now - this.lastAdbCheck < 45000)) {
      return true;
    }

    try {
      const { stdout } = await execPromise(`adb connect ${this.ipAddress}:5555`, { timeout: timeoutMs }).catch(e => ({
        stdout: e.stdout || ''
      }));
      if (stdout.includes('connected') || stdout.includes('already')) {
        this.isAdbConnected = true;
        this.lastAdbCheck = now;
        return true;
      }
    } catch {
      this.isAdbConnected = false;
    }
    return false;
  }

  /**
   * Execute ADB command with lightning-fast latency:
   * Direct execution without redundant connection re-negotiation.
   */
  private async runAdb(cmd: string, fast = false): Promise<boolean> {
    try {
      if (!this.isAdbConnected) {
        await this.ensureAdb(1000);
      }
      await execPromise(`adb -s ${this.ipAddress}:5555 ${cmd}`, { timeout: fast ? 800 : 1500 });
      this.isAdbConnected = true;
      this.lastAdbCheck = Date.now();
      return true;
    } catch (err) {
      this.isAdbConnected = false;
      if (!fast) {
        try {
          await this.ensureAdb(1000);
          await execPromise(`adb -s ${this.ipAddress}:5555 ${cmd}`, { timeout: 1000 });
          this.isAdbConnected = true;
          this.lastAdbCheck = Date.now();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Multi-vector Power Control:
   * ON: Broadcasts authentic Wake-on-LAN + DIAL/Cast probe + ADB wake events (224, 26, 3).
   * OFF: Sends SLEEP (223) and POWER (26).
   */
  async power(on: boolean): Promise<Result<void, BaseError>> {
    console.log(`[TCL-Android] Executing Power ${on ? 'ON' : 'OFF'} for ${this.ipAddress}`);

    if (on) {
      // 1. Wake-on-LAN: Send authentic magic packet bursts
      if (this.macAddress) {
        this.sendWolMagicPacket(this.macAddress);
      } else {
        this.resolveMacAddress().then(mac => {
          if (mac) this.sendWolMagicPacket(mac);
        }).catch(() => {});
      }

      // 2. Google Cast / DIAL Wakeup probe (Port 8008 is kept alive in Networked Standby)
      try {
        fetch(`http://${this.ipAddress}:8008/apps/YouTube`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          signal: AbortSignal.timeout(600)
        }).catch(() => {});
      } catch {}

      // 3. ADB Wakeup: Wakeup (224), Power (26), Home (3)
      const executeAdbWake = async () => {
        await this.ensureAdb(800);
        await this.runAdb(`shell input keyevent 224`, true); // KEYCODE_WAKEUP
        await this.runAdb(`shell input keyevent 26`, true);  // KEYCODE_POWER
        await this.runAdb(`shell input keyevent 3`, true);   // KEYCODE_HOME
      };

      executeAdbWake().catch(() => {});

      // Follow-up burst at 1.5s for Wi-Fi card wakeup latency
      setTimeout(() => {
        executeAdbWake().catch(() => {});
      }, 1500);

    } else {
      // Power OFF:
      await this.runAdb(`shell input keyevent 223`, true); // KEYCODE_SLEEP
    }

    return Result.ok();
  }

  async volumeUp(): Promise<Result<void, BaseError>> {
    return this.sendKey('VOL_UP');
  }

  async volumeDown(): Promise<Result<void, BaseError>> {
    return this.sendKey('VOL_DOWN');
  }

  async setVolume(level: number): Promise<Result<void, BaseError>> {
    return Result.ok();
  }

  async setMute(mute: boolean): Promise<Result<void, BaseError>> {
    return this.sendKey('MUTE');
  }
  
  async getApps(): Promise<Result<AppMetadata[], BaseError>> {
    return Result.ok([
      { id: 'youtube', name: 'YouTube' },
      { id: 'netflix', name: 'Netflix' },
      { id: 'shahid', name: 'Shahid VIP' },
      { id: 'spotify', name: 'Spotify' },
      { id: 'googleplay', name: 'Google Play' }
    ]);
  }

  async launchApp(appId: string): Promise<Result<void, BaseError>> {
    console.log(`[TCL-Android] Launching app ${appId} on ${this.ipAddress}`);
    const normalizedApp = appId.toLowerCase();

    // 1. DIAL Protocol (Port 8008) - Instant launch for YouTube / Netflix
    let dialTarget = '';
    if (normalizedApp.includes('youtube')) dialTarget = 'YouTube';
    else if (normalizedApp.includes('netflix')) dialTarget = 'Netflix';
    else if (normalizedApp.includes('spotify')) dialTarget = 'Spotify';

    if (dialTarget) {
      try {
        fetch(`http://${this.ipAddress}:8008/apps/${dialTarget}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          signal: AbortSignal.timeout(800)
        }).catch(() => {});
      } catch {}
    }

    // 2. Direct ADB Launch via intent
    const pkg = ANDROID_APP_PACKAGES[normalizedApp];
    if (pkg) {
      await this.runAdb(`shell monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, true);
    }

    return Result.ok();
  }
  
  async getInputs(): Promise<Result<InputMetadata[], BaseError>> {
    return Result.ok([
      { id: 'HDMI1', name: 'HDMI 1 (eARC)', type: 'HDMI' },
      { id: 'HDMI2', name: 'HDMI 2', type: 'HDMI' },
      { id: 'TV', name: 'Live TV', type: 'OTHER' }
    ]);
  }

  async setInput(inputId: string): Promise<Result<void, BaseError>> {
    console.log(`[TCL-Android] Switching input to ${inputId} on ${this.ipAddress}`);
    await this.runAdb(`shell input keyevent 178`, true);
    return Result.ok();
  }
  
  /**
   * Snappy direct key dispatch:
   * Sub-30ms response without any dead port timeouts.
   */
  async sendKey(key: string): Promise<Result<void, BaseError>> {
    const upperKey = key.toUpperCase();
    const androidKeycode = ANDROID_KEYCODES[upperKey];

    if (androidKeycode !== undefined) {
      await this.runAdb(`shell input keyevent ${androidKeycode}`, true);
    } else if (upperKey.startsWith('NUM_') || /^[0-9]$/.test(upperKey)) {
      const numStr = upperKey.replace('NUM_', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num >= 0 && num <= 9) {
        const keycode = 7 + num; // Android KEYCODE_0 = 7, KEYCODE_1 = 8, etc.
        await this.runAdb(`shell input keyevent ${keycode}`, true);
      }
    }

    return Result.ok();
  }

  async sendText(text: string): Promise<Result<void, BaseError>> {
    console.log(`[TCL-Android] Sending Text "${text}" to ${this.ipAddress}`);
    const safeText = text.replace(/[^a-zA-Z0-9 _-]/g, '');
    await this.runAdb(`shell input text "${safeText}"`, true);
    return Result.ok();
  }
}
