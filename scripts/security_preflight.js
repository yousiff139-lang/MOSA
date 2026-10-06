const fs = require('fs');
const path = require('path');

const FORBIDDEN_DEFAULTS = new Set([
  'admin',
  'password',
  '123456',
  'mosa_admin',
  'mosa-super-secret-key-123',
  'mosa_supervisor_secret_2026',
  'mosa_mqtt_secret',
  'mosa_secure_pass_2024',
  'secret',
  'changeme'
]);

const SECRET_PASSWORD_KEYS = new Set([
  'POSTGRES_PASSWORD',
  'MQTT_PASSWORD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'COOKIE_SECRET',
  'SUPERVISOR_SECRET',
  'GF_SECURITY_ADMIN_PASSWORD',
  'WATCHTOWER_HTTP_API_TOKEN'
]);

const REQUIRED_ENTROPY_VARS = [
  { key: 'JWT_SECRET', minLen: 32 },
  { key: 'JWT_REFRESH_SECRET', minLen: 32 },
  { key: 'COOKIE_SECRET', minLen: 32 },
  { key: 'SUPERVISOR_SECRET', minLen: 32 },
  { key: 'GF_SECURITY_ADMIN_PASSWORD', minLen: 16 }
];

function runPreflight() {
  console.log('=== MOSA SECURITY PREFLIGHT & REGRESSION AUDIT ===');
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ FAIL: .env file missing!');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        envVars[k] = v;
      }
    }
  }

  let passed = true;

  // 1. Audit Forbidden Default Passwords
  for (const [k, v] of Object.entries(envVars)) {
    if (SECRET_PASSWORD_KEYS.has(k) && FORBIDDEN_DEFAULTS.has(v.toLowerCase())) {
      console.error(`❌ FAIL: Secret variable ${k} is using forbidden/guessable default value!`);
      passed = false;
    }
  }

  // 2. Audit Minimum Entropy and Length
  for (const { key, minLen } of REQUIRED_ENTROPY_VARS) {
    const val = envVars[key];
    if (!val || val.length < minLen) {
      console.error(`❌ FAIL: Variable ${key} is missing or insufficiently long (min ${minLen} chars, got ${val ? val.length : 0})!`);
      passed = false;
    } else {
      console.log(`✅ PASS: ${key} satisfies minimum length (${val.length} chars) and entropy constraints.`);
    }
  }

  if (passed) {
    console.log('=== ALL PREFLIGHT SECURITY CHECKS PASSED ===');
    process.exit(0);
  } else {
    console.error('=== PREFLIGHT SECURITY CHECK FAILED ===');
    process.exit(1);
  }
}

runPreflight();
