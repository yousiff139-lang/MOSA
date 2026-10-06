// scripts/generate-ota-keys.js
// Run this file once to generate production Ed25519 keys for OTA updates.
// node scripts/generate-ota-keys.js

const nacl = require('tweetnacl');
const util = require('tweetnacl-util');

console.log("=========================================");
console.log("MOSA Enterprise - Ed25519 OTA Key Generator");
console.log("=========================================\n");

// Generate a new keypair
const keypair = nacl.sign.keyPair();

// Convert to hex for easy storage in .env and C++ arrays
const publicKeyHex = Buffer.from(keypair.publicKey).toString('hex');
const secretKeyHex = Buffer.from(keypair.secretKey).toString('hex');

console.log("1. Add this to your API Server .env file:");
console.log("-----------------------------------------");
console.log(`OTA_SECRET_KEY=${secretKeyHex}`);
console.log("\n");

console.log("2. Add this to your ESP32-S3 Firmware (Config.h):");
console.log("-----------------------------------------");
// Format public key as C++ byte array
const pubKeyBytes = [];
for (let i = 0; i < publicKeyHex.length; i += 2) {
    pubKeyBytes.push('0x' + publicKeyHex.substring(i, i + 2));
}
console.log(`const uint8_t OTA_PUBLIC_KEY[32] = { ${pubKeyBytes.join(', ')} };`);
console.log("\n");

console.log("⚠️  WARNING: Keep the OTA_SECRET_KEY absolutely safe.");
console.log("If compromised, attackers can push malicious firmware to your smart homes.");
console.log("=========================================");
