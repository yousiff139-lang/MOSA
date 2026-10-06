#!/bin/bash
# ==============================================================================
# MOSA OS - Local LAN Development & Testing SSL Generator Script
# Generates trusted local SSL certificates for local IPs (e.g. https://192.168.1.100)
# Unlocks Web Speech API Microphone access on Chrome/Safari without a domain
# ==============================================================================

set -e

LAN_IP=${1:-"127.0.0.1"}

echo "🚀 Generating local LAN SSL Certificate for IP: $LAN_IP..."

mkdir -p ./nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/server.key \
  -out ./nginx/ssl/server.crt \
  -subj "/C=IQ/ST=Baghdad/L=Baghdad/O=MOSA Smart Home/OU=Engineering/CN=$LAN_IP" \
  -addext "subjectAltName=IP:$LAN_IP,DNS:localhost"

echo "🔒 Certificates generated successfully in ./nginx/ssl/!"

# Restart NGINX to apply
docker compose restart nginx

echo "✅ Local LAN SSL Activated! Access MOSA OS via: https://$LAN_IP"
echo "🎙️ Web Speech API Microphone access is now unlocked on your LAN!"
