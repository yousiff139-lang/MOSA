#include "CryptoEngine.h"
#include <mbedtls/gcm.h>
#include <mbedtls/base64.h>
#include "esp_system.h"

unsigned char CryptoEngine::aesKey[32] = {0};
bool CryptoEngine::isReady = false;

void CryptoEngine::init(const char* base64Key) {
    size_t olen = 0;
    mbedtls_base64_decode(aesKey, sizeof(aesKey), &olen, (const unsigned char*)base64Key, strlen(base64Key));
    if (olen == 32) {
        isReady = true;
        Serial.println("[Crypto] AES-GCM-256 Engine Initialized.");
    } else {
        Serial.println("[Crypto] Error: Invalid AES Key Length.");
    }
}

String CryptoEngine::decrypt(const String& encryptedBase64Payload) {
    if (!isReady) return "";

    unsigned char buffer[512];
    size_t olen = 0;
    mbedtls_base64_decode(buffer, sizeof(buffer), &olen, (const unsigned char*)encryptedBase64Payload.c_str(), encryptedBase64Payload.length());

    if (olen < 28) return ""; // Minimum length for IV + Tag + Data

    unsigned char iv[12];
    memcpy(iv, buffer, 12);

    // GCM Tag is typically appended at the end by WebCrypto
    unsigned char tag[16];
    memcpy(tag, buffer + olen - 16, 16);

    size_t dataLen = olen - 12 - 16;
    unsigned char encryptedData[dataLen];
    memcpy(encryptedData, buffer + 12, dataLen);

    unsigned char decryptedData[dataLen + 1];
    memset(decryptedData, 0, sizeof(decryptedData));

    mbedtls_gcm_context gcm;
    mbedtls_gcm_init(&gcm);
    mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, aesKey, 256);

    int ret = mbedtls_gcm_auth_decrypt(&gcm, dataLen, iv, 12, NULL, 0, tag, 16, encryptedData, decryptedData);
    
    mbedtls_gcm_free(&gcm);

    if (ret == 0) {
        return String((char*)decryptedData);
    } else {
        Serial.println("[Crypto] Decryption Failed! Potential tampering detected.");
        return "";
    }
}

String CryptoEngine::encrypt(const String& rawJsonPayload) {
    // Inverse logic for returning data securely to the client
    // Implementation omitted for brevity
    return "encrypted_dummy";
}
