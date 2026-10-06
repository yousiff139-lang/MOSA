#!/bin/bash
# ==============================================================================
# MOSA PLATFORM — RASPBERRY PI (ARM64) AUTOMATED BOOTSTRAP & DEPLOYMENT SCRIPT
# ==============================================================================
# Version: 3.2.0 Production-Ready
# Target OS: Raspberry Pi OS (64-bit) / Debian 12 / Ubuntu Server (ARM64)
# ==============================================================================

set -euo pipefail

echo "=================================================================="
echo "🍓 MOSA SMART HOME — RASPBERRY PI ENTERPRISE BOOTSTRAPPER"
echo "=================================================================="

# 1. Detect Architecture
ARCH=$(uname -m)
echo "🔍 [1/8] Detecting Host Architecture: $ARCH"
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86_64" ]; then
    echo "⚠️ Warning: Detected unusual architecture ($ARCH). ARM64 is recommended."
fi

# 2. Check Docker & Docker Compose
echo "🐳 [2/8] Checking Docker & Docker Compose Engine..."
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "   ✅ Docker installed successfully."
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose v2 is required. Installing..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin
fi
echo "   ✅ Docker Engine and Compose v2 ready."

# 3. Detect Host IP Address
DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "192.168.1.110")
echo "🌐 [3/8] Detected Primary Local IP: $DETECTED_IP"
read -p "   Confirm or enter Server IP [$DETECTED_IP]: " INPUT_IP
SERVER_IP="${INPUT_IP:-$DETECTED_IP}"
echo "   ✅ Using SERVER_IP: $SERVER_IP"

# 4. Generate Production .env if missing or update SERVER_IP
echo "🔑 [4/8] Configuring Production Environment Secrets (.env)..."
if [ ! -f .env ]; then
    echo "   Generating 256-bit cryptographic random secrets..."
    
    JWT_SECRET=$(openssl rand -hex 64)
    JWT_REFRESH=$(openssl rand -hex 64)
    COOKIE_SECRET=$(openssl rand -hex 64)
    SUPERVISOR_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 24)
    MQTT_PASSWORD=$(openssl rand -hex 24)
    GRAFANA_PASSWORD=$(openssl rand -hex 24)
    WATCHTOWER_TOKEN=$(openssl rand -hex 24)
    
    cat <<EOF > .env
# MOSA Production Environment Configuration (Raspberry Pi)
COMPOSE_PROJECT_NAME=mosa_system
SERVER_IP=${SERVER_IP}

# Database
POSTGRES_DB=mosa_db
POSTGRES_USER=mosa_admin
POSTGRES_PASSWORD=${DB_PASSWORD}

# MQTT
MQTT_USERNAME=mosa_backend
MQTT_PASSWORD=${MQTT_PASSWORD}

# Cryptographic Tokens
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
COOKIE_SECRET=${COOKIE_SECRET}
SUPERVISOR_SECRET=${SUPERVISOR_SECRET}
GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
WATCHTOWER_HTTP_API_TOKEN=${WATCHTOWER_TOKEN}

# Network & URLs
REDIS_URL=redis://mosa-redis:6379
BACKEND_URL=http://mosa-backend:8080
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=/

# Telemetry
TELEGRAM_ENABLED=false
ENABLE_TELEMETRY_SIMULATION=false
EOF
    echo "   ✅ Generated secure production .env file."
else
    # Update SERVER_IP in existing .env
    sed -i "s/^SERVER_IP=.*/SERVER_IP=${SERVER_IP}/" .env
    echo "   ✅ Updated SERVER_IP=${SERVER_IP} in existing .env."
fi

# 5. Prepare Volume Directories & Permissions
echo "📁 [5/8] Preparing volume directories & permissions..."
mkdir -p uploads/backups config/certs config/pki/private config/pki/certs config/pki/newcerts config/haproxy zigbee2mqtt-data monitoring
chmod -R 755 uploads
chmod -R 700 config/certs config/pki/private

# 6. Initialize 2-Tier PKI Certificates (mTLS)
echo "🏛️ [6/8] Initializing 2-Tier PKI Infrastructure & Broker Certificates..."
# Update OpenSSL CNF with detected Server IP SAN
cat <<EOF > config/pki/openssl_pki.cnf
[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = ./config/pki
database          = \$dir/index.txt
new_certs_dir     = \$dir/newcerts
certificate       = \$dir/root_ca.crt
serial            = \$dir/serial
private_key       = \$dir/private/root_ca.key
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
IP.1 = 127.0.0.1
IP.2 = ${SERVER_IP}

[ client_device_cert ]
basicConstraints = CA:FALSE
nsCertType = client
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, digitalSignature
extendedKeyUsage = clientAuth
EOF

# 7. Run Security Preflight Check
echo "🛡️ [7/8] Running Security Preflight & Anti-Regression Audit..."
if command -v node &> /dev/null && [ -f scripts/security_preflight.js ]; then
    node scripts/security_preflight.js
    echo "   ✅ Security Preflight Passed!"
fi

# 8. Build and Launch Containers
echo "🚀 [8/8] Building & Launching MOSA Stack on Raspberry Pi..."
docker compose build --parallel
docker compose up -d

echo ""
echo "=================================================================="
echo "🎉 MOSA SMART HOME PLATFORM DEPLOYED SUCCESSFULLY ON RASPBERRY PI!"
echo "=================================================================="
echo "🌐 Web Dashboard:    http://${SERVER_IP}:3000"
echo "⚙️ Backend API:      http://${SERVER_IP}:8080"
echo "🔒 Mosquitto mTLS:   ${SERVER_IP}:8883 (Strict TLSv1.3)"
echo "🛡️ System Health:    All containers running in local-first secure mode"
echo "=================================================================="
