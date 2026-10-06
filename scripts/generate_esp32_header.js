const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cleanMac = '3030F96A1F5C';
const keyPath = '/tmp/esp32_live.key';
const csrPath = '/tmp/esp32_live.csr';
const crtPath = '/tmp/esp32_live.crt';

// 1. Generate ECDSA P-256 private key
execSync(`openssl ecparam -name prime256v1 -genkey -noout -out ${keyPath}`);

// 2. Generate CSR with CN=MosaNode_<MAC>
execSync(`openssl req -new -key ${keyPath} -out ${csrPath} -subj "/CN=MosaNode_${cleanMac}"`);

// 3. Sign with new Intermediate CA (client_device_cert extensions)
execSync(`openssl x509 -req -in ${csrPath} -CA /app/config/pki/intermediate_ca.crt -CAkey /app/config/pki/private/intermediate_ca.key -CAcreateserial -days 365 -sha256 -extfile /app/config/pki/openssl_pki.cnf -extensions client_device_cert -out ${crtPath}`);

const keyPem = fs.readFileSync(keyPath, 'utf8');
const crtPem = fs.readFileSync(crtPath, 'utf8');
const caChainPem = fs.readFileSync('/app/config/pki/ca_chain.crt', 'utf8');

const headerContent = `// Auto-generated mTLS Certificate Header for ESP32 Physical Node (MosaNode_${cleanMac})
// Generated under 2-Tier MOSA PKI (Intermediate CA Signature)
#ifndef MOSA_MTLS_CERTS_H
#define MOSA_MTLS_CERTS_H

const char ca_cert_pem[] PROGMEM = R"EOF(
${caChainPem.trim()}
)EOF";

const char client_cert_pem[] PROGMEM = R"EOF(
${crtPem.trim()}
)EOF";

const char client_key_pem[] PROGMEM = R"EOF(
${keyPem.trim()}
)EOF";

#endif // MOSA_MTLS_CERTS_H
`;

const destPath = '/app/R1_Refactored/esp32_mtls_certs.h';
fs.writeFileSync(destPath, headerContent, 'utf8');
console.log(`✅ SUCCESS: Generated new 2-Tier PKI certificate header for MosaNode_${cleanMac} at ${destPath}`);
