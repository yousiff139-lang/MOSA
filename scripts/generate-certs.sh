#!/bin/bash
# Generate CA and Mosquitto Certificates for mTLS

set -e

DIR="mosquitto_certs"
mkdir -p $DIR
cd $DIR

echo "Generating Certificate Authority (CA)..."
openssl req -new -x509 -days 3650 -extensions v3_ca -keyout ca.key -out ca.crt -nodes -subj "/C=IQ/ST=Baghdad/L=Baghdad/O=MOSA Smart Home/OU=IoT/CN=MOSA Root CA"

echo "Generating Mosquitto Server Key and CSR..."
openssl genrsa -out server.key 2048
openssl req -out server.csr -key server.key -new -subj "/C=IQ/ST=Baghdad/L=Baghdad/O=MOSA Smart Home/OU=Broker/CN=localhost"

echo "Signing Mosquitto Server Certificate with CA..."
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 3650

echo "Generating Client Key and CSR for testing..."
openssl genrsa -out client.key 2048
openssl req -out client.csr -key client.key -new -subj "/C=IQ/ST=Baghdad/L=Baghdad/O=MOSA Smart Home/OU=Device/CN=TestDevice01"

echo "Signing Client Certificate with CA..."
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 3650

echo "Done! Certificates generated in $DIR"
echo "- ca.crt (Copy to clients and Mosquitto)"
echo "- server.crt / server.key (Copy to Mosquitto config)"
echo "- client.crt / client.key (Copy to ESP32)"
