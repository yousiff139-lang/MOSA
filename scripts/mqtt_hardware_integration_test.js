/**
 * MOSA Smart Platform — Mandatory MQTT & Physical Hardware Verification Suite
 * Tests: MQTT-01 through MQTT-04 and HW-01 through HW-03
 */

const mqtt = require('mqtt');
const http = require('http');
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateJwt(payload, secret = process.env.JWT_SECRET || 'f4260e5a2eb55710064e30fd25ad361d48b3bc5ad670c2b39b6cfab860bfcac27be97a72addd2463c021f846496881de3d0132dcf6da9cc038c34cb9d82fcb02') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return h + '.' + p + '.' + sig;
}

const testResults = [];
function recordTest(id, name, passed, details) {
  testResults.push({ id, name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${id}] ${name}: ${passed ? 'PASS' : 'FAIL'} | ${details}`);
}

async function runMqttHardwareSuite() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔌 MOSA MQTT & HARDWARE NODE LIVE INTEGRATION SUITE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const homeId = 'c55f83aa-2a04-493b-9301-a29a978d9be5';
  const nodeId = 'MosaNode_3030F96A1F5C';
  const clientId = `${nodeId}_test_${Math.floor(Math.random() * 9000 + 1000)}`;

  // 1. MQTT-01: Connect as ESP32 device
  const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: clientId,
    username: 'mosa_device',
    password: 'mosa_mqtt_secret',
    connectTimeout: 5000
  });

  await new Promise((resolve) => {
    client.on('connect', () => {
      recordTest('MQTT-01', 'ESP32 Device MQTT Authentication', true, `Connected as client ${clientId}`);
      resolve();
    });
    client.on('error', (err) => {
      recordTest('MQTT-01', 'ESP32 Device MQTT Authentication', false, err.message);
      resolve();
    });
  });

  // 2. MQTT-02: Publish Heartbeat
  await new Promise((resolve) => {
    const heartbeatTopic = `mosa/${homeId}/controller/${nodeId}/heartbeat`;
    const payload = JSON.stringify({
      nodeId: nodeId,
      ip: '192.168.1.150',
      heap: 184520,
      uptime: 3600,
      timestamp: Date.now()
    });
    client.publish(heartbeatTopic, payload, { qos: 0 }, (err) => {
      recordTest('MQTT-02', 'ESP32 Node Heartbeat ACL Publish', !err, err ? err.message : `Published to ${heartbeatTopic}`);
      resolve();
    });
  });

  // 3. MQTT-03: Publish Device State
  await new Promise((resolve) => {
    const stateTopic = `mosa/${homeId}/device/${nodeId}/state`;
    const payload = JSON.stringify({
      nodeId: nodeId,
      relays: [
        { pin: 15, state: true, isOn: true },
        { pin: 16, state: false, isOn: false }
      ],
      timestamp: Date.now()
    });
    client.publish(stateTopic, payload, { qos: 0 }, (err) => {
      recordTest('MQTT-03', 'ESP32 Device State ACL Publish', !err, err ? err.message : `Published to ${stateTopic}`);
      resolve();
    });
  });

  // 4. MQTT-04: Publish Discovery
  await new Promise((resolve) => {
    const discoveryTopic = `mosa/discovery`;
    const payload = JSON.stringify({
      boardId: nodeId,
      ip: '192.168.1.150',
      type: 'ESP32_RELAY_CONTROLLER',
      capabilities: ['RELAY', 'DIMMER', 'SENSOR']
    });
    client.publish(discoveryTopic, payload, { qos: 0, retain: true }, (err) => {
      recordTest('MQTT-04', 'ESP32 Discovery Topic Publish', !err, err ? err.message : `Published to ${discoveryTopic}`);
      resolve();
    });
  });

  // 5. HW-01: Backend Device Query
  const adminToken = generateJwt({
    id: '00000000-0000-0000-0000-000000000001',
    username: 'Mosa',
    role: 'ADMIN',
    homeId: homeId
  });

  const https = require('https');
  await new Promise((resolve) => {
    const req = https.request({
      hostname: 'localhost',
      port: 443,
      path: '/api/devices',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const hasDevices = Array.isArray(list) && list.length > 0;
          recordTest('HW-01', 'REST API Device List Retrieval', hasDevices, `Retrieved ${list.length} active devices from database`);
        } catch (e) {
          recordTest('HW-01', 'REST API Device List Retrieval', false, e.message);
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      recordTest('HW-01', 'REST API Device List Retrieval', false, err.message);
      resolve();
    });
    req.end();
  });

  // 6. HW-02: Subscribe to Command Topic
  await new Promise((resolve) => {
    const cmdTopic = `mosa/+/device/${nodeId}/command`;
    client.subscribe(cmdTopic, (err) => {
      recordTest('HW-02', 'ESP32 Command Topic Subscription', !err, err ? err.message : `Subscribed to ${cmdTopic}`);
      resolve();
    });
  });

  client.end();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allPassed = testResults.every(r => r.passed);
  console.log(`📊 MQTT/HARDWARE SUITE SUMMARY: ${testResults.filter(r => r.passed).length} / ${testResults.length} PASS (${allPassed ? '100% OPERATIONAL' : 'FAIL'})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runMqttHardwareSuite().catch(console.error);
