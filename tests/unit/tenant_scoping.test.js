/**
 * Unit Test: Multi-Tenant Scoping & Topic Isolation (Fast, Isolated - Zero Docker Dependency)
 */

const assert = require('assert');

// Pure MQTT Topic Parsing & Identity Scoping Validator
function parseMqttTopic(topic) {
  const parts = topic.split('/');
  if (parts.length < 4 || parts[0] !== 'mosa') return null;
  return {
    prefix: parts[0],
    homeId: parts[1],
    category: parts[2],
    entityId: parts[3],
    action: parts[4] || null
  };
}

function isAuthorized(clientIdentity, topic, accessType = 'write') {
  const parsed = parseMqttTopic(topic);
  if (!parsed) return false;

  // System master accounts bypass home restriction
  if (clientIdentity.isMaster) return true;

  // Device/Tenant identity MUST strictly match the home partition segment (%u)
  if (clientIdentity.username !== parsed.homeId) {
    return false;
  }

  // Categories allowed for device tier
  const allowedCategories = ['device', 'controller', 'sensor', 'ota'];
  if (!allowedCategories.includes(parsed.category)) {
    return false;
  }

  return true;
}

// Test Suite
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 RUNNING UNIT TESTS: Multi-Tenant Scoping Logic');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Test 1: Topic Parsing
const parsed = parseMqttTopic('mosa/home_alpha/device/relay_1/state');
assert.deepStrictEqual(parsed, {
  prefix: 'mosa',
  homeId: 'home_alpha',
  category: 'device',
  entityId: 'relay_1',
  action: 'state'
});

// Test 2: Intra-Home Access
const clientAlpha = { username: 'home_alpha', isMaster: false };
assert.strictEqual(isAuthorized(clientAlpha, 'mosa/home_alpha/device/relay_1/state'), true, 'Alpha should access Alpha topic');

// Test 3: Cross-Home Access Denial
assert.strictEqual(isAuthorized(clientAlpha, 'mosa/home_beta/device/relay_2/command'), false, 'Alpha MUST NOT access Beta topic');

// Test 4: Master Bypass
const masterClient = { username: 'mosa-backend', isMaster: true };
assert.strictEqual(isAuthorized(masterClient, 'mosa/home_beta/device/relay_2/command'), true, 'Master should access any home');

console.log('✅ [UNIT-04] MQTT Topic Grammar Parser: PASS');
console.log('✅ [UNIT-05] Intra-Tenant Access Authorization: PASS');
console.log('✅ [UNIT-06] Cross-Tenant Boundary Rejection: PASS');
console.log('✅ [UNIT-07] Master System Role Scoping: PASS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎉 ALL TENANT SCOPING UNIT TESTS PASSED (100% ISOLATED)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
