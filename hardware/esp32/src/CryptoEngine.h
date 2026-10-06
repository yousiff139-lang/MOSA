#ifndef CRYPTO_ENGINE_H
#define CRYPTO_ENGINE_H

#include <Arduino.h>

class CryptoEngine {
public:
    static void init(const char* base64Key);
    static String decrypt(const String& encryptedBase64Payload);
    static String encrypt(const String& rawJsonPayload);
private:
    static unsigned char aesKey[32];
    static bool isReady;
};

#endif
