const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PKI_DIR = path.resolve(__dirname, '../../config/pki');
const CERTS_DIR = path.resolve(__dirname, '../../config/certs');
const OPENSSL_CNF = path.resolve(PKI_DIR, 'openssl_pki.cnf');

function run(cmd) {
  console.log(`[PKI-EXEC] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function secureWipe(filePath) {
  if (!fs.existsSync(filePath)) return;
  const len = fs.statSync(filePath).size;
  // Overwrite with random bytes
  const garbage = require('crypto').randomBytes(len);
  fs.writeFileSync(filePath, garbage);
  // Overwrite with zeroes
  fs.writeFileSync(filePath, Buffer.alloc(len, 0));
  // Unlink file
  fs.unlinkSync(filePath);
  console.log(`[SECURE-WIPE] Securely wiped and deleted: ${filePath}`);
}

async function main() {
  console.log('=== INITIALIZING 2-TIER MOSA PKI INFRASTRUCTURE ===\n');

  // 1. Prepare directories
  fs.mkdirSync(path.join(PKI_DIR, 'private'), { recursive: true });
  fs.mkdirSync(path.join(PKI_DIR, 'certs'), { recursive: true });
  fs.mkdirSync(path.join(PKI_DIR, 'newcerts'), { recursive: true });
  fs.mkdirSync(CERTS_DIR, { recursive: true });

  fs.writeFileSync(path.join(PKI_DIR, 'index.txt'), '');
  fs.writeFileSync(path.join(PKI_DIR, 'serial'), '1000\n');

  const rootKeyPath = path.join(PKI_DIR, 'private/root_ca.key');
  const rootCrtPath = path.join(PKI_DIR, 'root_ca.crt');
  const interKeyPath = path.join(PKI_DIR, 'private/intermediate_ca.key');
  const interCsrPath = path.join(PKI_DIR, 'intermediate_ca.csr');
  const interCrtPath = path.join(PKI_DIR, 'intermediate_ca.crt');
  const serverKeyPath = path.join(PKI_DIR, 'private/server.key');
  const serverCsrPath = path.join(PKI_DIR, 'server.csr');
  const serverCrtPath = path.join(PKI_DIR, 'server.crt');
  const caChainPath = path.join(PKI_DIR, 'ca_chain.crt');

  // ==========================================
  // Step 1: Generate Tier-1 Root CA (ECDSA P-384)
  // ==========================================
  console.log('\n--- Step 1: Generating Tier-1 Root CA (ECDSA secp384r1) ---');
  run(`openssl ecparam -name secp384r1 -genkey -noout -out "${rootKeyPath}"`);
  run(`openssl req -config "${OPENSSL_CNF}" -key "${rootKeyPath}" -new -x509 -days 3650 -sha384 -extensions v3_root_ca -out "${rootCrtPath}" -subj "/C=IQ/O=MosaSmartHome/CN=MOSA Root CA"`);

  // ==========================================
  // Step 2: Generate Tier-2 Device Issuing Intermediate CA (ECDSA P-256)
  // ==========================================
  console.log('\n--- Step 2: Generating Tier-2 Device Issuing CA (ECDSA prime256v1) ---');
  run(`openssl ecparam -name prime256v1 -genkey -noout -out "${interKeyPath}"`);
  run(`openssl req -config "${OPENSSL_CNF}" -new -sha256 -key "${interKeyPath}" -out "${interCsrPath}" -subj "/C=IQ/O=MosaSmartHome/CN=MOSA Device Issuing Intermediate CA"`);
  run(`openssl x509 -req -days 1095 -in "${interCsrPath}" -CA "${rootCrtPath}" -CAkey "${rootKeyPath}" -CAcreateserial -out "${interCrtPath}" -extfile "${OPENSSL_CNF}" -extensions v3_intermediate_ca`);

  // ==========================================
  // Step 3: Generate Mosquitto Broker Server Certificate (ECDSA P-256)
  // ==========================================
  console.log('\n--- Step 3: Generating Mosquitto Server Broker Certificate (ECDSA prime256v1) ---');
  run(`openssl ecparam -name prime256v1 -genkey -noout -out "${serverKeyPath}"`);
  run(`openssl req -config "${OPENSSL_CNF}" -new -sha256 -key "${serverKeyPath}" -out "${serverCsrPath}" -subj "/C=IQ/O=MosaSmartHome/CN=mosa-mosquitto"`);
  run(`openssl x509 -req -days 730 -in "${serverCsrPath}" -CA "${interCrtPath}" -CAkey "${interKeyPath}" -CAcreateserial -out "${serverCrtPath}" -extfile "${OPENSSL_CNF}" -extensions server_cert`);

  // ==========================================
  // Step 4: Assemble CA Chain & Deploy to config/certs
  // ==========================================
  console.log('\n--- Step 4: Assembling CA Chain Bundle ---');
  const interCrtContent = fs.readFileSync(interCrtPath, 'utf8');
  const rootCrtContent = fs.readFileSync(rootCrtPath, 'utf8');
  fs.writeFileSync(caChainPath, interCrtContent + '\n' + rootCrtContent, 'utf8');

  // Copy to config/certs for Mosquitto & Backend
  fs.copyFileSync(caChainPath, path.join(CERTS_DIR, 'ca_chain.crt'));
  fs.copyFileSync(caChainPath, path.join(CERTS_DIR, 'ca.crt'));
  fs.copyFileSync(rootCrtPath, path.join(CERTS_DIR, 'root_ca.crt'));
  fs.copyFileSync(interCrtPath, path.join(CERTS_DIR, 'intermediate_ca.crt'));
  fs.copyFileSync(interKeyPath, path.join(CERTS_DIR, 'intermediate_ca.key'));
  // Bundle Server Certificate with Intermediate CA for complete server chain delivery
  fs.writeFileSync(path.join(CERTS_DIR, 'server.crt'), fs.readFileSync(serverCrtPath, 'utf8').trim() + '\n' + fs.readFileSync(interCrtPath, 'utf8').trim() + '\n');
  fs.copyFileSync(serverKeyPath, path.join(CERTS_DIR, 'server.key'));

  // Generate fresh CRL signed by Intermediate CA
  run(`openssl ca -config "${OPENSSL_CNF}" -gencrl -keyfile "${interKeyPath}" -cert "${interCrtPath}" -out "${path.join(CERTS_DIR, 'crl.pem')}"`);

  console.log('\n--- Step 5: Verification of Generated Certificates ---');
  run(`openssl verify -CAfile "${rootCrtPath}" "${interCrtPath}"`);
  run(`openssl verify -CAfile "${rootCrtPath}" -untrusted "${interCrtPath}" "${serverCrtPath}"`);

  console.log('\n================================================================');
  console.log('🏛️  2-TIER PKI HIERARCHY GENERATED & VERIFIED SUCCESSFULLY');
  console.log('================================================================');
  console.log(`\n🔑 Root CA Private Key location: ${rootKeyPath}`);
  console.log('⚠️  OPERATOR ACTION REQUIRED:');
  console.log('   1. Copy "root_ca.key" to an offline removable storage media (e.g. Hardware USB Vault).');
  console.log('   2. Execute secure wipe of "root_ca.key" to guarantee zero live persistence.');
  console.log('   3. Run with --wipe-root-key to automatically wipe root_ca.key immediately.');
  console.log('================================================================\n');

  if (process.argv.includes('--wipe-root-key')) {
    secureWipe(rootKeyPath);
  }
}

main().catch(err => {
  console.error('❌ PKI Generation Failed:', err);
  process.exit(1);
});
