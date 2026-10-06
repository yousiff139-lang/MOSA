#!/bin/bash
# ==============================================================================
# MOSA OS - Production Let's Encrypt Auto-SSL Setup Script
# Automatically provisions official trusted Green Lock SSL certificate via Certbot
# Enforces Web Speech API microphone persistence for Voice Assistant & PWA
# ==============================================================================

set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "❌ Usage: ./scripts/setup-ssl.sh <your-domain.com> <your-email@example.com>"
    exit 1
fi

echo "🚀 Starting MOSA OS SSL Provisioning for domain: $DOMAIN..."

# 1. Install Certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot & NGINX plugin..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx
fi

# 2. Stop NGINX container temporarily or issue via standalone
echo "🔑 Requesting official Let's Encrypt certificate..."
certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

# 3. Symlink certs to MOSA NGINX folder
echo "🔒 Link certificates to NGINX SSL directory..."
mkdir -p ./nginx/ssl
cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ./nginx/ssl/server.crt
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ./nginx/ssl/server.key

# 4. Reload NGINX
echo "🔄 Reloading MOSA NGINX Container..."
docker compose restart nginx

echo "✅ SSL Certificate Provisioned Successfully!"
echo "🌐 Your MOSA platform is now live at: https://$DOMAIN"
echo "🎙️ Web Speech API & Microphone access persistence is now UNLOCKED!"
