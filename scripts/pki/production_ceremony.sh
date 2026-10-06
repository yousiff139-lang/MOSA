#!/bin/bash
# ==============================================================================
# MOSA Smart Home Platform - Production 2-Tier PKI Ceremony Script
# ==============================================================================
# Purpose: Interactive ceremony to generate Root CA, Intermediate CA, and Server
#          certificates, with mandatory physical export of root_ca.key before wipe.
# ==============================================================================

set -euo pipefail

PKI_DIR="./config/pki"
CERTS_DIR="./config/certs"
OPENSSL_CNF="${PKI_DIR}/openssl_pki.cnf"

echo "======================================================================"
echo "🏛️  MOSA PRODUCTION 2-TIER PKI GENERATION CEREMONY"
echo "======================================================================"

mkdir -p "${PKI_DIR}/private" "${PKI_DIR}/certs" "${PKI_DIR}/newcerts" "${CERTS_DIR}"
touch "${PKI_DIR}/index.txt"
echo "1000" > "${PKI_DIR}/serial"

ROOT_KEY="${PKI_DIR}/private/root_ca.key"
ROOT_CRT="${PKI_DIR}/root_ca.crt"
INTER_KEY="${PKI_DIR}/private/intermediate_ca.key"
INTER_CSR="${PKI_DIR}/intermediate_ca.csr"
INTER_CRT="${PKI_DIR}/intermediate_ca.crt"
SERVER_KEY="${PKI_DIR}/private/server.key"
SERVER_CSR="${PKI_DIR}/server.csr"
SERVER_CRT="${PKI_DIR}/server.crt"
CA_CHAIN="${PKI_DIR}/ca_chain.crt"

# 1. Generate Tier-1 Root CA (ECDSA secp384r1)
echo "[1/4] Generating Tier-1 Offline Root CA (ECDSA P-384, 10-Year Validity)..."
openssl ecparam -name secp384r1 -genkey -noout -out "${ROOT_KEY}"
openssl req -config "${OPENSSL_CNF}" -key "${ROOT_KEY}" -new -x509 -days 3650 -sha384 \
    -extensions v3_root_ca -out "${ROOT_CRT}" \
    -subj "/C=IQ/O=MosaSmartHome/CN=MOSA Root CA"

# 2. Generate Tier-2 Device Issuing Intermediate CA (ECDSA prime256v1)
echo "[2/4] Generating Tier-2 Device Issuing Intermediate CA (ECDSA P-256, pathlen:0)..."
openssl ecparam -name prime256v1 -genkey -noout -out "${INTER_KEY}"
openssl req -config "${OPENSSL_CNF}" -new -sha256 -key "${INTER_KEY}" -out "${INTER_CSR}" \
    -subj "/C=IQ/O=MosaSmartHome/CN=MOSA Device Issuing Intermediate CA"
openssl x509 -req -days 1095 -in "${INTER_CSR}" -CA "${ROOT_CRT}" -CAkey "${ROOT_KEY}" \
    -CAcreateserial -out "${INTER_CRT}" -extfile "${OPENSSL_CNF}" -extensions v3_intermediate_ca

# 3. Generate Mosquitto Broker Server Certificate (Signed by Intermediate CA)
echo "[3/4] Generating Mosquitto Server Broker Certificate..."
openssl ecparam -name prime256v1 -genkey -noout -out "${SERVER_KEY}"
openssl req -config "${OPENSSL_CNF}" -new -sha256 -key "${SERVER_KEY}" -out "${SERVER_CSR}" \
    -subj "/C=IQ/O=MosaSmartHome/CN=mosa-mosquitto"
openssl x509 -req -days 730 -in "${SERVER_CSR}" -CA "${INTER_CRT}" -CAkey "${INTER_KEY}" \
    -CAcreateserial -out "${SERVER_CRT}" -extfile "${OPENSSL_CNF}" -extensions server_cert

# 4. Assemble CA Chain & Deploy
echo "[4/4] Assembling CA Chain and Deploying to config/certs..."
cat "${INTER_CRT}" "${ROOT_CRT}" > "${CA_CHAIN}"
cp "${CA_CHAIN}" "${CERTS_DIR}/ca_chain.crt"
cp "${CA_CHAIN}" "${CERTS_DIR}/ca.crt"
cp "${ROOT_CRT}" "${CERTS_DIR}/root_ca.crt"
cp "${INTER_CRT}" "${CERTS_DIR}/intermediate_ca.crt"
cp "${INTER_KEY}" "${CERTS_DIR}/intermediate_ca.key"
cp "${SERVER_CRT}" "${CERTS_DIR}/server.crt"
cp "${SERVER_KEY}" "${CERTS_DIR}/server.key"

# Generate fresh CRL
openssl ca -config "${OPENSSL_CNF}" -gencrl -keyfile "${INTER_KEY}" -cert "${INTER_CRT}" -out "${CERTS_DIR}/crl.pem"

echo "======================================================================"
echo "⚠️  CRITICAL OPERATOR STEP: OFFLINE BACKUP REQUIRED"
echo "======================================================================"
echo "The Tier-1 Root CA private key is located at:"
echo "  -> ${ROOT_KEY}"
echo ""
echo "Please perform the following steps NOW:"
echo "  1. Copy '${ROOT_KEY}' to a dedicated encrypted offline storage (e.g. Hardware USB Vault)."
echo "  2. Verify the copy was successful."
echo "======================================================================"
read -p "Type 'EXPORTED' once the key has been securely backed up offline: " CONFIRM

if [ "$CONFIRM" = "EXPORTED" ]; then
    echo "Securely wiping ${ROOT_KEY} from live filesystem..."
    shred -u -z -n 5 "${ROOT_KEY}" 2>/dev/null || (
        dd if=/dev/urandom of="${ROOT_KEY}" bs=1k count=1 conv=notrunc 2>/dev/null
        dd if=/dev/zero of="${ROOT_KEY}" bs=1k count=1 conv=notrunc 2>/dev/null
        rm -f "${ROOT_KEY}"
    )
    echo "✅ Root key securely erased from host disk. Only Intermediate CA remains active."
else
    echo "❌ Confirmation not received. Root key left in place — please handle manually."
fi
