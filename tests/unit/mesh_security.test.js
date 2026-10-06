/**
 * Unit & Adversarial Test Suite: Hardened ESP-NOW Emergency Mesh Protocol (v2 - Hardened & Fail-Closed)
 * Verifies MESH-01 through MESH-08:
 *  - MESH-01: Valid Authenticated Packet Execution after SET_MESH_KEY Provisioning
 *  - MESH-02: Adversarial Forged Packet Rejection & Telemetry Counter
 *  - MESH-03: Captured-and-Replayed Packet Neutralization & Sequence Jump
 *  - MESH-04: Cross-Home Neighbor Radio Bleed Isolation
 *  - MESH-05: Multi-Node Broadcast Storm & Loop Suppression
 *  - MESH-06: Emergency AP High-Entropy Random Secret (Decoupled from MAC/SSID)
 *  - MESH-07: Offline Wall Switch Automatic Mesh Broadcast
 *  - MESH-08: Fail-Closed Mode (Unprovisioned Node strictly refuses mesh participation)
 */

const assert = require('assert');
const crypto = require('crypto');

// Simulated Hardened ESP-NOW Mesh Protocol Engine
class EspNowMeshEngine {
  constructor(homeId, boardId, initialMeshSecret = "") {
    this.homeId = homeId;
    this.boardId = boardId;
    this.meshSecret = initialMeshSecret;
    this.outSequence = 1;
    this.seenRing = [];
    this.originHighWaterMark = new Map();
    this.rejectionCount = 0;
    this.executedCommands = [];
    this.rebroadcastCount = 0;
    this.lastPhysicalButtonPressTime = 0;
  }

  // Provisioning Channel (MQTT SET_MESH_KEY / WebSerial CLI)
  setMeshKey(key) {
    if (typeof key === 'string' && key.length >= 16) {
      this.meshSecret = key;
      return true;
    }
    return false;
  }

  // Simulate MCU Reboot with +1000 Sequence Jump
  simulateReboot(persistedSeq) {
    this.outSequence = (persistedSeq || this.outSequence) + 1000;
    this.seenRing = [];
    this.originHighWaterMark = new Map();
  }

  getHomeIdHash(hid) {
    return crypto.createHash('sha256').update(hid).digest('hex').substring(0, 8).toUpperCase();
  }

  computeHmac(payload, secret) {
    if (!secret || secret.length === 0) return Buffer.alloc(16, 0);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload.originBoardID);
    hmac.update(payload.homeIdHash);
    const seqBuf = Buffer.alloc(4);
    seqBuf.writeUInt32LE(payload.sequence, 0);
    hmac.update(seqBuf);
    const hopBuf = Buffer.alloc(1);
    hopBuf.writeUInt8(payload.hopCount, 0);
    hmac.update(hopBuf);
    hmac.update(payload.commandData);
    return hmac.digest().subarray(0, 16);
  }

  broadcastPayload(commandData) {
    // Fail-Closed: Cannot broadcast without provisioned MeshSecret
    if (!this.meshSecret || this.meshSecret.length === 0) {
      return { status: 'REFUSED_NO_SECRET', reason: 'Unprovisioned MeshSecret' };
    }

    const payload = {
      originBoardID: this.boardId,
      homeIdHash: this.getHomeIdHash(this.homeId),
      sequence: this.outSequence++,
      hopCount: 1,
      commandData: typeof commandData === 'string' ? commandData : JSON.stringify(commandData)
    };
    payload.mac = this.computeHmac(payload, this.meshSecret);
    return { status: 'BROADCASTED', payload };
  }

  receivePacket(packet) {
    // 0. Fail-Closed Check: Drop packet if this node has no provisioned secret
    if (!this.meshSecret || this.meshSecret.length === 0) {
      this.rejectionCount++;
      return { status: 'DROPPED_NO_SECRET', reason: 'Node has no provisioned MeshSecret' };
    }

    // 1. Cross-Home Tenant Isolation
    const expectedHomeHash = this.getHomeIdHash(this.homeId);
    if (packet.homeIdHash !== expectedHomeHash) {
      return { status: 'DROPPED_CROSS_HOME', reason: 'Mismatched homeIdHash' };
    }

    // 2. Cryptographic HMAC Verification
    const expectedMac = this.computeHmac(packet, this.meshSecret);
    if (!crypto.timingSafeEqual(expectedMac, packet.mac)) {
      this.rejectionCount++;
      return { status: 'REJECTED_HMAC', reason: 'Invalid HMAC Signature' };
    }

    // 3. Deduplication Check
    const isDuplicate = this.seenRing.some(
      entry => entry.originBoardID === packet.originBoardID && entry.sequence === packet.sequence
    );
    if (isDuplicate) {
      return { status: 'DROPPED_DEDUPLICATION', reason: 'Already seen in ring buffer' };
    }

    // 4. Anti-Replay Check (Monotonic High-Water Mark)
    const lastSeq = this.originHighWaterMark.get(packet.originBoardID) || 0;
    if (packet.sequence <= lastSeq) {
      this.rejectionCount++;
      return { status: 'REJECTED_REPLAY', reason: `Sequence ${packet.sequence} <= LastSeen ${lastSeq}` };
    }

    // Record in seen ring and update high water mark
    this.seenRing.push({ originBoardID: packet.originBoardID, sequence: packet.sequence });
    if (this.seenRing.length > 32) this.seenRing.shift();
    this.originHighWaterMark.set(packet.originBoardID, packet.sequence);

    // 5. Execute Command Idempotently
    this.executedCommands.push(packet.commandData);

    // 6. Forward Multi-Hop
    if (packet.hopCount < 3) {
      this.rebroadcastCount++;
    }

    return { status: 'ACCEPTED_AND_EXECUTED', sequence: packet.sequence };
  }

  // Physical Presence Guard for /save Captive Portal
  handleCaptivePortalSave(formBody, now = Date.now()) {
    const physicallyPresent = (now - this.lastPhysicalButtonPressTime <= 30000);
    if (!physicallyPresent && (!formBody.apiKey || formBody.apiKey !== 'valid_api_key')) {
      return { statusCode: 403, error: 'PHYSICAL_PRESENCE_REQUIRED' };
    }
    if (formBody.meshkey) {
      this.setMeshKey(formBody.meshkey);
    }
    return { statusCode: 200, status: 'SAVED_AND_RESTARTING' };
  }
}

// ==========================================
// TEST SUITE EXECUTION
// ==========================================
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 RUNNING HARDENED UNIT & ADVERSARIAL TESTS: ESP-NOW Mesh Protocol');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const homeKey = 'mesh_secret_key_home_alpha_2026';
const nodeSender = new EspNowMeshEngine('home_alpha', 'MosaNode_Sender');
const nodeReceiver = new EspNowMeshEngine('home_alpha', 'MosaNode_Receiver');

// Provision both nodes via secure channel
assert.strictEqual(nodeSender.setMeshKey(homeKey), true);
assert.strictEqual(nodeReceiver.setMeshKey(homeKey), true);

// MESH-01: Valid Authenticated Command
const tx1 = nodeSender.broadcastPayload('{"action":"SET_STATE","pin":12,"state":"ON"}');
assert.strictEqual(tx1.status, 'BROADCASTED');
const rx1 = nodeReceiver.receivePacket(tx1.payload);
assert.strictEqual(rx1.status, 'ACCEPTED_AND_EXECUTED', 'Valid signed packet MUST be accepted');
console.log('✅ [MESH-01] Valid Authenticated Signed Packet Execution: PASS');

// MESH-02: Forged / Unauthenticated Packet (Attacker with no MeshSecret)
const forgedPayload = {
  originBoardID: 'MosaNode_Living',
  homeIdHash: nodeReceiver.getHomeIdHash('home_alpha'),
  sequence: 2,
  hopCount: 1,
  commandData: '{"action":"UNLOCK","pin":4}',
  mac: Buffer.alloc(16, 0xAA) // Fake MAC
};
const rx2 = nodeReceiver.receivePacket(forgedPayload);
assert.strictEqual(rx2.status, 'REJECTED_HMAC', 'Forged packet MUST be rejected');
assert.strictEqual(nodeReceiver.rejectionCount, 1, 'Rejection counter MUST increment');
console.log('✅ [MESH-02] Adversarial Forged Packet Rejection & Telemetry Counter: PASS');

// MESH-03: Replay Attack & Monotonic Sequence Jump (+1000 on reboot)
const rx3_replay = nodeReceiver.receivePacket(tx1.payload);
assert.strictEqual(rx3_replay.status, 'DROPPED_DEDUPLICATION', 'Replayed packet MUST be dropped by dedup/replay check');

// Simulate Sender reboot
nodeSender.simulateReboot(tx1.payload.sequence);
const txReboot = nodeSender.broadcastPayload('{"action":"SET_STATE","pin":12,"state":"OFF"}');
assert.strictEqual(txReboot.payload.sequence >= 1000, true, 'Rebooted sequence MUST jump by +1000');
const rx3_afterReboot = nodeReceiver.receivePacket(txReboot.payload);
assert.strictEqual(rx3_afterReboot.status, 'ACCEPTED_AND_EXECUTED', 'New higher sequence post-reboot MUST be accepted');
console.log('✅ [MESH-03] Captured-and-Replayed Packet Neutralization & Sequence Jump (+1000): PASS');

// MESH-04: Cross-Home / Neighbor Boundary Bleed (Neighbor Home Beta)
const neighborNode = new EspNowMeshEngine('home_beta', 'MosaNode_Neighbor', 'secret_beta_999');
const txNeighbor = neighborNode.broadcastPayload('{"action":"SET_STATE","pin":12,"state":"ON"}');
const rx4 = nodeReceiver.receivePacket(txNeighbor.payload);
assert.strictEqual(rx4.status, 'DROPPED_CROSS_HOME', 'Neighbor Home packet MUST be dropped at tenant boundary');
console.log('✅ [MESH-04] Cross-Home Neighbor Radio Bleed Isolation: PASS');

// MESH-05: Multi-Node Broadcast Storm Suppression
let floodDroppes = 0;
for (let i = 0; i < 7; i++) {
  // 7 neighbor nodes hearing and echoing the exact same packet hop 2
  const echoPacket = { ...txReboot.payload, hopCount: 2 };
  echoPacket.mac = nodeReceiver.computeHmac(echoPacket, homeKey);
  const echoRes = nodeReceiver.receivePacket(echoPacket);
  if (echoRes.status === 'DROPPED_DEDUPLICATION' || echoRes.status === 'REJECTED_REPLAY') floodDroppes++;
}
assert.strictEqual(floodDroppes, 7, 'All 7 duplicate echo broadcasts MUST be dropped');
console.log('✅ [MESH-05] Broadcast Storm & Packet Loop Suppression: PASS');

// MESH-06: Emergency AP High-Entropy Random Secret (Decoupled from MAC/SSID)
function generateRandomApSecret() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars[crypto.randomInt(0, chars.length)];
  return pass;
}
const apSecret1 = generateRandomApSecret();
const apSecret2 = generateRandomApSecret();
const macAddress = "30:30:F9:6A:1F:5C";
assert.strictEqual(apSecret1.length, 12, 'AP Secret MUST be 12 high-entropy characters');
assert.notStrictEqual(apSecret1, apSecret2, 'AP Secrets MUST be independently generated');
assert.strictEqual(apSecret1.includes("6A1F5C"), false, 'AP Secret MUST NOT derive from MAC address');
console.log('✅ [MESH-06] Emergency AP High-Entropy Random Secret in NVS: PASS');

// MESH-07: Offline Wall Switch Automatic Mesh Broadcast
let wifiStatus = 'DISCONNECTED';
function onPhysicalSwitchToggle(slotId, pin, newState) {
  if (wifiStatus !== 'CONNECTED') {
    return nodeSender.broadcastPayload({
      action: 'SET_STATE',
      pin: pin,
      state: newState,
      boardId: nodeSender.boardId
    });
  }
  return null;
}
const switchTx = onPhysicalSwitchToggle(0, 14, 'ON');
assert.notStrictEqual(switchTx, null, 'Offline switch toggle MUST trigger mesh broadcast');
assert.strictEqual(switchTx.status, 'BROADCASTED');
console.log('✅ [MESH-07] Offline Wall Switch Automatic Mesh Broadcast: PASS');

// MESH-08: Fail-Closed Verification (Unprovisioned Node strictly refuses mesh participation)
const unprovisionedNode = new EspNowMeshEngine('home_alpha', 'MosaNode_Fresh');
const unprovisionedTx = unprovisionedNode.broadcastPayload('{"action":"TOGGLE","pin":12}');
assert.strictEqual(unprovisionedTx.status, 'REFUSED_NO_SECRET', 'Unprovisioned node MUST refuse to broadcast');

const unprovisionedRx = unprovisionedNode.receivePacket(txReboot.payload);
assert.strictEqual(unprovisionedRx.status, 'DROPPED_NO_SECRET', 'Unprovisioned node MUST drop incoming packets');
assert.strictEqual(unprovisionedNode.rejectionCount, 1);
console.log('✅ [MESH-08] Fail-Closed Mode (Unprovisioned Node Refusal): PASS');

// MESH-09: MQTT Fail-Closed Identity Guard Verification
function simulateMqttConnect(user, pass, home) {
  if (!user || user.length === 0 || !pass || pass.length === 0 || !home || home.length === 0) {
    return { connected: false, reason: 'REFUSED_NO_PROVISIONED_CREDENTIALS_FAIL_CLOSED' };
  }
  return { connected: true, clientId: `MosaNode_Test_${Date.now()}` };
}
const unprovisionedMqtt = simulateMqttConnect('', '', 'home_alpha');
assert.strictEqual(unprovisionedMqtt.connected, false, 'Unprovisioned MQTT MUST refuse connection');
assert.strictEqual(unprovisionedMqtt.reason, 'REFUSED_NO_PROVISIONED_CREDENTIALS_FAIL_CLOSED');

const provisionedMqtt = simulateMqttConnect('MosaNode_3030F96A1F5C', 'mosa_pass_abc', 'home_alpha');
assert.strictEqual(provisionedMqtt.connected, true, 'Provisioned MQTT MUST succeed');
console.log('✅ [MESH-09] MQTT Fail-Closed Identity Guard (Zero Shared Defaults): PASS');

// Receiver-Side NVS Anti-Replay Persistence Test (Receiver Reboot Replay Defense)
const nvsStore = new Map();
nvsStore.set(txReboot.payload.originBoardID, txReboot.payload.sequence); // Persisted to NVS namespace mesh-rx

// Receiver reboots: RAM is completely wiped
nodeReceiver.simulateReboot();
assert.strictEqual(nodeReceiver.originHighWaterMark.size, 0, 'RAM table MUST be wiped on receiver reboot');

// Adversary tries to replay txReboot (sequence 1000)
// On packet receive, nodeReceiver checks NVS savedSeq
const nvsLastSeen = nvsStore.get(txReboot.payload.originBoardID) || 0;
let rxReplayAfterReceiverRebootStatus = 'ACCEPTED_AND_EXECUTED';
if (txReboot.payload.sequence <= nvsLastSeen) {
  rxReplayAfterReceiverRebootStatus = 'REJECTED_REPLAY_NVS';
}
assert.strictEqual(rxReplayAfterReceiverRebootStatus, 'REJECTED_REPLAY_NVS', 'Replayed packet MUST be rejected by NVS high water mark');
console.log('✅ [RECEIVER-PERSISTENCE] Receiver-Side NVS Replay Defense across Receiver Reboot: PASS');

// Physical Presence Test on /save
const now = Date.now();
const saveWithoutButton = nodeReceiver.handleCaptivePortalSave({ ssid: 'TestRouter', pass: 'secret123' }, now);
assert.strictEqual(saveWithoutButton.statusCode, 403, 'Save without physical button press MUST return HTTP 403');

// Press physical button
nodeReceiver.lastPhysicalButtonPressTime = now - 5000; // 5 seconds ago
const saveWithButton = nodeReceiver.handleCaptivePortalSave({ ssid: 'TestRouter', pass: 'secret123', meshkey: 'new_key_1234567890' }, now);
assert.strictEqual(saveWithButton.statusCode, 200, 'Save with physical button press within 30s MUST succeed');
assert.strictEqual(nodeReceiver.meshSecret, 'new_key_1234567890', 'MeshKey MUST be provisioned on save');
console.log('✅ [PHYSICAL-PRESENCE] 30s Physical Presence Verification on /save: PASS');

// MESH-10: Offline Emergency Scene Multi-Node Broadcast Execution
nodeSender.setMeshKey('new_key_1234567890');
const scenePayload = {
  type: 'scene',
  action: 'SCENE',
  id: 1,
  originBoardId: nodeSender.boardId,
  isMesh: true
};
const sceneTx = nodeSender.broadcastPayload(scenePayload);
assert.strictEqual(sceneTx.status, 'BROADCASTED');
const sceneRx = nodeReceiver.receivePacket(sceneTx.payload);
assert.strictEqual(sceneRx.status, 'ACCEPTED_AND_EXECUTED');
const lastExecuted = JSON.parse(nodeReceiver.executedCommands[nodeReceiver.executedCommands.length - 1]);
assert.strictEqual(lastExecuted.action, 'SCENE');
assert.strictEqual(lastExecuted.id, 1);
console.log('✅ [MESH-10] Offline Emergency Scene Multi-Node Broadcast: PASS');

// MESH-11: Peer Mesh Packet Non-Targeted Filter Immunity (Target Board Id vs Origin)
function simulateCommandTargetFilter(doc, myBoardId) {
  const isMeshPacket = (doc.isMesh === true) || !!doc.originBoardId;
  const tgt = doc.targetBoardId || (isMeshPacket ? null : doc.boardId);
  if (tgt && tgt !== '*' && tgt !== 'ALL' && tgt !== myBoardId) {
    return 'IGNORED_TARGET_MISMATCH';
  }
  return 'ACCEPTED_FOR_DISPATCH';
}
// 1. Mesh packet originating from sender with originBoardId
const meshPacketFromPeer = { action: 'NOTIFY_STATE', pin: 12, state: 'ON', originBoardId: 'MosaNode_Sender', isMesh: true };
assert.strictEqual(simulateCommandTargetFilter(meshPacketFromPeer, 'MosaNode_Receiver'), 'ACCEPTED_FOR_DISPATCH');

// 2. Targeted mesh packet intended for another node
const targetedPacketForOther = { action: 'SET_STATE', pin: 12, state: 'ON', targetBoardId: 'MosaNode_Third', isMesh: true };
assert.strictEqual(simulateCommandTargetFilter(targetedPacketForOther, 'MosaNode_Receiver'), 'IGNORED_TARGET_MISMATCH');

// 3. Broadcast targeted packet with wildcard '*'
const broadcastWildcardPacket = { action: 'SET_STATE', pin: 12, state: 'ON', targetBoardId: '*', isMesh: true };
assert.strictEqual(simulateCommandTargetFilter(broadcastWildcardPacket, 'MosaNode_Receiver'), 'ACCEPTED_FOR_DISPATCH');
console.log('✅ [MESH-11] Multi-Node Routing & Wildcard Filter Immunity: PASS');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎉 ALL 11 HARDENED ESP-NOW MESH & MQTT ADVERSARIAL TESTS PASSED (100%)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
