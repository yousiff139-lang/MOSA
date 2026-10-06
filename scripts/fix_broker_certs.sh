#!/bin/bash
# ==============================================================================
# MOSA Smart Home - Mosquitto mTLS Server Certificate SAN Regenerator
# Updates server.crt to include Raspberry Pi IP (192.168.1.110) while preserving
# the existing Intermediate CA and Root CA (No ESP32 cert reflashing needed!)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "=================================================================="
echo "🛡️  MOSA MQTT BROKER mTLS SAN FIX (Target IP: 192.168.1.110)"
echo "=================================================================="

PKI_DIR="config/pki"
CERTS_DIR="config/certs"
OPENSSL_CNF="$PKI_DIR/openssl_pki.cnf"

mkdir -p "$PKI_DIR" "$CERTS_DIR"

echo "📝 [1/4] Writing OpenSSL config with complete SAN IP & DNS entries..."
cat << 'EOF' > "$OPENSSL_CNF"
[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = ./config/pki
database          = $dir/index.txt
new_certs_dir     = $dir/newcerts
certificate       = $dir/root_ca.crt
serial            = $dir/serial
private_key       = $dir/private/root_ca.key
default_md        = sha256
default_crl_days  = 30
policy            = policy_loose

[ policy_loose ]
countryName             = optional
stateOrProvinceName     = optional
localityName            = optional
organizationName        = optional
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[ v3_root_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:1
keyUsage = critical, keyCertSign, cRLSign

[ v3_intermediate_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, keyCertSign, cRLSign

[ server_cert ]
basicConstraints = CA:FALSE
nsCertType = server
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @server_alt_names

[ server_alt_names ]
DNS.1 = mosa-mosquitto
DNS.2 = localhost
DNS.3 = mosa.local
DNS.4 = mosa-server.local
DNS.5 = mosa-server
DNS.6 = mosa-home.tail01b9ef.ts.net
DNS.7 = mosa-home
IP.1 = 127.0.0.1
IP.2 = 192.168.1.110
IP.3 = 192.168.1.103
IP.4 = 192.168.1.100
IP.5 = 192.168.1.101
IP.6 = 192.168.1.102
IP.7 = 192.168.1.105
IP.8 = 100.84.195.7
IP.9 = 100.109.5.29

[ client_device_cert ]
basicConstraints = CA:FALSE
nsCertType = client
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, digitalSignature
extendedKeyUsage = clientAuth
EOF

echo "🔑 [2/4] Signing new server certificate using existing Intermediate CA..."
openssl req -config "$OPENSSL_CNF" -new -sha256 -key "$CERTS_DIR/server.key" -out "$PKI_DIR/server.csr" -subj "/C=IQ/O=MosaSmartHome/CN=mosa-mosquitto"
openssl x509 -req -days 730 -in "$PKI_DIR/server.csr" -CA "$CERTS_DIR/intermediate_ca.crt" -CAkey "$CERTS_DIR/intermediate_ca.key" -CAcreateserial -out "$PKI_DIR/server.crt" -extfile "$OPENSSL_CNF" -extensions server_cert

echo "📋 [3/4] Installing certificate chain into Mosquitto certs folder..."
cat "$PKI_DIR/server.crt" "$CERTS_DIR/intermediate_ca.crt" > "$CERTS_DIR/server.crt"

echo "🔄 [4/4] Restarting Mosquitto container to load new certificate..."
if command -v docker &> /dev/null; then
    docker compose restart mosquitto || sudo docker restart mosa-mosquitto || true
fi

echo "=================================================================="
echo "✅ Mosquitto mTLS Server Certificate successfully updated!"
echo "   Server SANs now include: 192.168.1.110, mosa-server.local, etc."
echo "   ESP32 hardware nodes will now verify mTLS successfully without error."
echo "=================================================================="
