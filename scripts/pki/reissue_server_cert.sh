#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== REISSUING MOSQUITTO SERVER CERTIFICATE FOR IP 192.168.1.110 ==="
cd "$ROOT_DIR"

if [ ! -f "config/certs/server.key" ] || [ ! -f "config/certs/intermediate_ca.crt" ] || [ ! -f "config/certs/intermediate_ca.key" ]; then
  echo "❌ Error: CA files missing in config/certs!"
  exit 1
fi

echo "1. Generating CSR for mosa-mosquitto..."
openssl req -new -key config/certs/server.key -out config/certs/server.csr -subj "/C=IQ/O=MosaSmartHome/CN=mosa-mosquitto"

echo "2. Signing server certificate with SANs including IP 192.168.1.110..."
openssl x509 -req -days 730 \
  -in config/certs/server.csr \
  -CA config/certs/intermediate_ca.crt \
  -CAkey config/certs/intermediate_ca.key \
  -CAcreateserial \
  -out config/certs/server_leaf.crt \
  -extfile config/pki/openssl_pki.cnf \
  -extensions server_cert

echo "3. Bundling server certificate with Intermediate CA..."
cat config/certs/server_leaf.crt config/certs/intermediate_ca.crt > config/certs/server.crt
rm -f config/certs/server.csr config/certs/server_leaf.crt

echo "4. Restarting Mosquitto container to reload certificates..."
docker restart mosa-mosquitto || true

echo "✅ SUCCESS: Mosquitto server certificate reissued with IP 192.168.1.110 and reloaded!"
openssl x509 -in config/certs/server.crt -noout -text | grep -A 3 "Subject Alternative Name"
