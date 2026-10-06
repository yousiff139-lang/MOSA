"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signPackage = signPackage;
exports.verifyPackage = verifyPackage;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
function signPackage(manifest, privateKeyPath) {
    const privateKey = (0, fs_1.readFileSync)(privateKeyPath);
    const signer = (0, crypto_1.createSign)('RSA-SHA256');
    // Sort keys to guarantee deterministic verification
    const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
    signer.update(canonical);
    return signer.sign(privateKey, 'base64');
}
function verifyPackage(manifest, publicKey) {
    const verifier = (0, crypto_1.createVerify)('RSA-SHA256');
    const manifestWithoutSignature = { ...manifest };
    delete manifestWithoutSignature.signature;
    const canonical = JSON.stringify(manifestWithoutSignature, Object.keys(manifestWithoutSignature).sort());
    verifier.update(canonical);
    try {
        return verifier.verify(publicKey, manifest.signature, 'base64');
    }
    catch (err) {
        return false;
    }
}
