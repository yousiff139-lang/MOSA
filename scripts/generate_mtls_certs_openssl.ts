import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const certsDir = path.resolve(process.cwd(), 'config', 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}
const certsDirWin = certsDir.replace(/\\/g, '/');

console.log('[OpenSSL Native Engine] Generating 100% compliant X.509 certificates via OpenSSL...');

const scriptContent = `set -e
openssl req -x509 -newkey rsa:2048 -nodes -keyout /certs/ca.key -out /certs/ca.crt -days 3650 -subj '/CN=MOSA Root CA/O=MOSA Smart Platform'

cat << 'EOF' > /certs/server_ext.cnf
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
[req_distinguished_name]
CN = 192.168.1.102
O = MOSA Broker
[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
DNS.2 = mosa-mosquitto
IP.1 = 127.0.0.1
IP.2 = 192.168.1.102
IP.3 = 192.168.1.101
EOF

openssl req -newkey rsa:2048 -nodes -keyout /certs/server.key -out /certs/server.csr -config /certs/server_ext.cnf
openssl x509 -req -in /certs/server.csr -CA /certs/ca.crt -CAkey /certs/ca.key -CAcreateserial -out /certs/server.crt -days 1825 -extfile /certs/server_ext.cnf -extensions v3_req

openssl req -newkey rsa:2048 -nodes -keyout /certs/backend.key -out /certs/backend.csr -subj '/CN=MOSA-BACKEND-API/O=MOSA Core'
openssl x509 -req -in /certs/backend.csr -CA /certs/ca.crt -CAkey /certs/ca.key -CAcreateserial -out /certs/backend.crt -days 1825

openssl req -newkey rsa:2048 -nodes -keyout /certs/device-001.key -out /certs/device-001.csr -subj '/CN=MOSA-ESP-001/O=MOSA Fleet'
openssl x509 -req -in /certs/device-001.csr -CA /certs/ca.crt -CAkey /certs/ca.key -CAcreateserial -out /certs/device-001.crt -days 1825

openssl req -x509 -newkey rsa:2048 -nodes -keyout /certs/fake_ca.key -out /certs/fake_ca.crt -days 365 -subj '/CN=Fake Root CA'
openssl req -newkey rsa:2048 -nodes -keyout /certs/untrusted-device.key -out /certs/untrusted-device.csr -subj '/CN=UNTRUSTED-DEVICE-999'
openssl x509 -req -in /certs/untrusted-device.csr -CA /certs/fake_ca.crt -CAkey /certs/fake_ca.key -CAcreateserial -out /certs/untrusted-device.crt -days 365

mkdir -p demoCA && touch demoCA/index.txt && echo 01 > demoCA/crlnumber
openssl ca -gencrl -keyfile /certs/ca.key -cert /certs/ca.crt -out /certs/crl.pem -config /etc/ssl/openssl.cnf
`;

fs.writeFileSync(path.join(certsDir, 'gen_certs.sh'), scriptContent.replace(/\r\n/g, '\n'));

execSync(`docker run --rm --entrypoint sh -v "${certsDirWin}:/certs" alpine/openssl /certs/gen_certs.sh`, { stdio: 'inherit' });

// Also mirror to mosquitto/config/certs
const mosqCertsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
if (!fs.existsSync(mosqCertsDir)) {
  fs.mkdirSync(mosqCertsDir, { recursive: true });
}
for (const file of fs.readdirSync(certsDir)) {
  fs.copyFileSync(path.join(certsDir, file), path.join(mosqCertsDir, file));
}

// Generate C Header for ESP32 Firmware
const caPem = fs.readFileSync(path.join(certsDir, 'ca.crt'), 'utf8');
const clientPem = fs.readFileSync(path.join(certsDir, 'device-001.crt'), 'utf8');
const keyPem = fs.readFileSync(path.join(certsDir, 'device-001.key'), 'utf8');

const headerContent = `// Auto-generated mTLS Certificate Header for ESP32 Firmware
#ifndef MOSA_MTLS_CERTS_H
#define MOSA_MTLS_CERTS_H

const char ca_cert_pem[] PROGMEM = R"EOF(
${caPem.trim()}
)EOF";

const char client_cert_pem[] PROGMEM = R"EOF(
${clientPem.trim()}
)EOF";

const char client_key_pem[] PROGMEM = R"EOF(
${keyPem.trim()}
)EOF";

#endif // MOSA_MTLS_CERTS_H
`;

fs.writeFileSync(path.join(certsDir, 'esp32-441BF68DB5A0.h'), headerContent);
fs.writeFileSync(path.resolve(process.cwd(), 'R1_Refactored', 'esp32_mtls_certs.h'), headerContent);

console.log('[OpenSSL Native Engine] ✅ Native OpenSSL certificates generated successfully!');
