const { execSync } = require('child_process');
const fs = require('fs');

const keyPath = '/app/config/certs/backend.key';
const csrPath = '/tmp/backend.csr';
const crtPath = '/app/config/certs/backend.crt';

// 1. Generate ECDSA P-256 key
execSync(`openssl ecparam -name prime256v1 -genkey -noout -out ${keyPath}`);

// 2. Generate CSR with CN=mosa-backend
execSync(`openssl req -new -key ${keyPath} -out ${csrPath} -subj "/CN=mosa-backend"`);

// 3. Sign with new Intermediate CA
execSync(`openssl x509 -req -in ${csrPath} -CA /app/config/pki/intermediate_ca.crt -CAkey /app/config/pki/private/intermediate_ca.key -CAcreateserial -days 365 -sha256 -extfile /app/config/pki/openssl_pki.cnf -extensions client_device_cert -out ${crtPath}`);

// Also copy to /app/certs if mounted separately
if (fs.existsSync('/app/certs')) {
  fs.copyFileSync(keyPath, '/app/certs/backend.key');
  fs.copyFileSync(crtPath, '/app/certs/backend.crt');
}

console.log('✅ Generated new backend mTLS certificate signed by new Intermediate CA');
