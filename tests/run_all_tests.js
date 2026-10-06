/**
 * MOSA Master Test Suite Runner
 * Runs Unit, Integration, and Regression tests in a clean unified interface.
 */

const { execSync } = require('child_process');
const path = require('path');

function runTestFile(filePath, name) {
  console.log(`\n▶️ Running: ${name} (${filePath})...`);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8', stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`❌ Test failed: ${name}`);
    return false;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏛️ MOSA CONSOLIDATED MASTER TEST HARNESS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let allPassed = true;

  // 1. Pure Unit Tests (Isolated, fast)
  console.log('\n[STAGE 1: FAST PURE UNIT TESTS]');
  const unit1 = runTestFile(path.resolve(__dirname, 'unit/automation_rules.test.js'), 'Automation Engine Logic');
  const unit2 = runTestFile(path.resolve(__dirname, 'unit/tenant_scoping.test.js'), 'Tenant Scoping Logic');
  const unit3 = runTestFile(path.resolve(__dirname, 'unit/mesh_security.test.js'), 'ESP-NOW Mesh Hardening & Anti-Replay');
  if (!unit1 || !unit2 || !unit3) allPassed = false;

  // 2. Integration & Release Gate
  console.log('\n[STAGE 2: INTEGRATION & RELEASE GATES]');
  const gate = runTestFile(path.resolve(__dirname, '../scripts/release_gate_verification.js'), 'Release Gate Verification');
  const mqttReg = runTestFile(path.resolve(__dirname, '../scripts/mqtt_comprehensive_regression.js'), 'MQTT & Hardware Regression');
  if (!gate || !mqttReg) allPassed = false;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (allPassed) {
    console.log('🎉 ALL TEST SUITES PASSED SUCCESSFULLY (100% GREEN)');
  } else {
    console.error('⚠️ SOME TESTS ENCOUNTERED FAILURES');
    process.exit(1);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
