import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationBridgeService } from '../src/services/integrationBridge.service.js';
import { HardwareScannerService } from '../src/services/hardwareScanner.service.js';

/**
 * Universal Integration & Hardware Scanner Test Suite
 * REQ Traceability: REQ-BRIDGE-001 (Commercial Device Bridge), REQ-USB-001 (Plug & Play Hardware Auto-Scanner)
 */

test('Integration Bridge: Local Commercial Devices Auto-Discovery (Tuya, Shelly, Hue)', async (t) => {
  const fakeServer: any = { log: { info: () => {} } };
  const bridgeService = new IntegrationBridgeService(fakeServer);

  const discovered = await bridgeService.scanLocalNetwork();
  assert.equal(discovered.length >= 2, true, "Bridge MUST discover commercial smart home devices on local network");

  const shelly = discovered.find(d => d.brand === 'SHELLY');
  assert.equal(shelly !== undefined, true, "Shelly smart plug MUST be discovered via mDNS");

  const pairResult = await bridgeService.pairDevice(shelly!.id);
  assert.equal(pairResult, true, "Discovered device MUST pair cleanly into MOSA platform");
});

test('Hardware Scanner: USB Dongles Auto-Detection (Zigbee 3.0 & ESP32 Serial)', async (t) => {
  const ports = await HardwareScannerService.scanUsbPorts();
  assert.equal(ports.length >= 2, true, "USB Scanner MUST auto-detect hardware ports");

  const zigbeeDongle = ports.find(p => p.deviceType === 'ZIGBEE_DONGLE');
  assert.equal(zigbeeDongle !== undefined, true, "Sonoff Zigbee 3.0 USB Dongle MUST be auto-detected");
  assert.equal(zigbeeDongle!.suggestedService, 'Zigbee2MQTT Gateway', "Zigbee dongle MUST suggest Zigbee2MQTT service");
});
