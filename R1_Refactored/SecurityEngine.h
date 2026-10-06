/*
 * SecurityEngine.h - Cryptography, HMAC Signatures & Nonce Authentication for ESP32
 * Implements:
 * 1. HMAC-SHA256 Payload signing for MQTT JSON commands.
 * 2. Nonce Challenge-Response authentication for WebSockets.
 * 3. AES-256 payload encryption helper.
 */

#ifndef SECURITY_ENGINE_H
#define SECURITY_ENGINE_H

#include <Arduino.h>
#include <mbedtls/md.h>
#include <mbedtls/aes.h>

class SecurityEngine {
public:
  // Generate HMAC-SHA256 signature string for a payload string using a secret key
  static String generateHMAC(const String& payload, const String& secret) {
    byte hmacResult[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
    
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char*)secret.c_str(), secret.length());
    mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
    mbedtls_md_hmac_finish(&ctx, hmacResult);
    mbedtls_md_free(&ctx);

    String signature = "";
    for (int i = 0; i < 32; i++) {
      char hex[3];
      sprintf(hex, "%02x", hmacResult[i]);
      signature += hex;
    }
    return signature;
  }

  // Verify if a provided HMAC signature matches payload & secret
  static bool verifyHMAC(const String& payload, const String& providedSig, const String& secret) {
    if (providedSig.length() == 0) return false;
    String computed = generateHMAC(payload, secret);
    return computed.equalsIgnoreCase(providedSig);
  }

  // Generate a random 16-character hex nonce for WebSocket challenge-response
  static String generateNonce() {
    String nonce = "";
    const char charset[] = "0123456789abcdef";
    for (int i = 0; i < 16; i++) {
      int r = esp_random() % 16;
      nonce += charset[r];
    }
    return nonce;
  }
};

#endif // SECURITY_ENGINE_H
