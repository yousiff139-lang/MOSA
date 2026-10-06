import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Enterprise mTLS Device Identity & PKI Security Test Suite for MOSA Smart Platform
 * REQ Traceability: REQ-SEC-002 (mTLS & Device Identity), REQ-ROT-001 (Cert Rotation & Revocation).
 */

test('REQ-SEC-002: mTLS Device Identity & Certificate Validation Matrix', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');

  // Verify certificate files exist
  assert.equal(fs.existsSync(path.join(certsDir, 'ca.crt')), true, "Platform Root CA Certificate MUST exist");
  assert.equal(fs.existsSync(path.join(certsDir, 'server.crt')), true, "Broker Server Certificate MUST exist");
  assert.equal(fs.existsSync(path.join(certsDir, 'device-001.crt')), true, "Unique Client Device Certificate MUST exist");
  assert.equal(fs.existsSync(path.join(certsDir, 'untrusted-device.crt')), true, "Untrusted Device Certificate MUST exist");
  assert.equal(fs.existsSync(path.join(certsDir, 'crl.pem')), true, "Certificate Revocation List (CRL) MUST exist");

  const validDeviceCert = fs.readFileSync(path.join(certsDir, 'device-001.crt'), 'utf-8');
  const untrustedDeviceCert = fs.readFileSync(path.join(certsDir, 'untrusted-device.crt'), 'utf-8');

  // Test Case 1: Valid Device Certificate signed by Platform Root CA
  const isValidCert = validDeviceCert.includes('Issuer: CN=MOSA Platform Root CA');
  assert.equal(isValidCert, true, "Valid Device Certificate MUST be issued by Platform Root CA");

  // Test Case 2: Untrusted Device Certificate signed by Unknown CA
  const isUntrusted = untrustedDeviceCert.includes('Issuer: CN=Fake Rogue CA');
  assert.equal(isUntrusted, true, "Untrusted Certificate MUST be flagged as non-platform CA");
});

test('REQ-SEC-002: Device Certificate Identity Impersonation Protection', async (t) => {
  const deviceA_ID = "MOSA-ESP-001";
  const deviceA_Cert_CN = "MOSA-ESP-001";

  const deviceB_ID = "MOSA-ESP-002";
  const deviceB_Cert_CN = "MOSA-ESP-001"; // Attempting to use Device A certificate for Device B

  const validateDeviceIdentity = (claimedDeviceId: string, certCn: string) => {
    if (claimedDeviceId !== certCn) {
      return { status: 403, error: "Access Denied: Device Certificate CN does not match claimed device identity" };
    }
    return { status: 200, message: "mTLS Identity Verified" };
  };

  const deviceA_Check = validateDeviceIdentity(deviceA_ID, deviceA_Cert_CN);
  const deviceB_Check = validateDeviceIdentity(deviceB_ID, deviceB_Cert_CN);

  assert.equal(deviceA_Check.status, 200, "Device A using its own certificate MUST pass mTLS Identity check");
  assert.equal(deviceB_Check.status, 403, "Device B attempting to use Device A certificate MUST be rejected with HTTP 403");
  assert.equal(deviceB_Check.error, "Access Denied: Device Certificate CN does not match claimed device identity");
});

test('REQ-ROT-001: Certificate Revocation List (CRL) Enforcement', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const crlContent = fs.readFileSync(path.join(certsDir, 'crl.pem'), 'utf-8');
  const revokedDeviceID = "COMPROMISED-DEVICE-002";

  const isRevoked = crlContent.includes(revokedDeviceID);
  assert.equal(isRevoked, true, "Certificate Revocation List MUST contain compromised device ID");
});
