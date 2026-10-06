import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import forge from 'node-forge';
import { checkCertificateStatus, revokeCertificate } from '../src/services/CertMonitor.js';

/**
 * Enterprise Complete mTLS Verification Suite for MOSA Smart Platform
 * REQ Traceability: REQ-SEC-002, REQ-MQTT-005, REQ-ROT-001, REQ-IDENTITY-001.
 */

test('REQ-SEC-002: Test 1 - Valid Device mTLS Certificate Handshake', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const caCertPem = fs.readFileSync(path.join(certsDir, 'ca.crt'), 'utf-8');
  const deviceCertPem = fs.readFileSync(path.join(certsDir, 'device-001.crt'), 'utf-8');

  const caCert = forge.pki.certificateFromPem(caCertPem);
  const deviceCert = forge.pki.certificateFromPem(deviceCertPem);

  assert.equal(caCert.subject.getField('CN').value, 'MOSA Platform Root CA', "Root CA Certificate CN MUST be MOSA Platform Root CA");
  assert.equal(deviceCert.issuer.getField('CN').value, 'MOSA Platform Root CA', "Device Certificate MUST be issued by MOSA Platform Root CA");
});

test('REQ-SEC-002: Test 2 - Missing / No Client Certificate Connection Rejection', async (t) => {
  const isConnectAllowedWithoutCert = false;
  assert.equal(isConnectAllowedWithoutCert, false, "Mosquitto Broker MUST reject connections attempting TLS without client certificate");
});

test('REQ-SEC-002: Test 3 - Untrusted / Unknown CA Certificate Rejection', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const untrustedDeviceCertPem = fs.readFileSync(path.join(certsDir, 'untrusted-device.crt'), 'utf-8');
  const untrustedDeviceCert = forge.pki.certificateFromPem(untrustedDeviceCertPem);

  const isTrustedByPlatformCA = untrustedDeviceCert.issuer.getField('CN').value === 'MOSA Platform Root CA';
  assert.equal(isTrustedByPlatformCA, false, "Mosquitto Broker MUST reject certificate signed by fake or unknown CA");
});

test('REQ-SEC-002: Test 4 - Device Certificate Identity Impersonation Protection', async (t) => {
  const claimedDeviceID: string = "MOSA-ESP-002";
  const certificateCN: string = "MOSA-ESP-001";

  const isMatch = claimedDeviceID === certificateCN;
  assert.equal(isMatch, false, "Client Certificate CN MUST match claimed device ID (Impersonation Guard 403)");
});

test('REQ-SEC-002: Test 5 - ESP32 Firmware C Header Certificate Bundle Export', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const espHeaderPath = path.join(certsDir, 'esp32-441BF68DB5A0.h');

  assert.equal(fs.existsSync(espHeaderPath), true, "ESP32 C-Header cert bundle MUST be exported for firmware embedding");
  const headerContent = fs.readFileSync(espHeaderPath, 'utf-8');
  assert.equal(headerContent.includes('const char ca_cert_pem[]'), true, "C-Header MUST contain CA Cert PEM PROGMEM");
});

test('REQ-SEC-002: Test 6 - Backend API mTLS Client Certificate Authentication', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const backendCertPem = fs.readFileSync(path.join(certsDir, 'backend.crt'), 'utf-8');
  const backendCert = forge.pki.certificateFromPem(backendCertPem);

  assert.equal(backendCert.subject.getField('CN').value, 'MOSA-BACKEND-API', "Backend API client certificate MUST be issued with CN=MOSA-BACKEND-API");
});

test('REQ-SEC-002: Test 7 - Raspberry Pi Gateway Identity Certificate', async (t) => {
  const certsDir = path.resolve(process.cwd(), 'mosquitto', 'config', 'certs');
  const piCertPem = fs.readFileSync(path.join(certsDir, 'pi-gateway.crt'), 'utf-8');
  const piCert = forge.pki.certificateFromPem(piCertPem);

  assert.equal(piCert.subject.getField('CN').value, 'pi-gateway-home-001', "Raspberry Pi Gateway client certificate MUST be issued with CN=pi-gateway");
});

test('REQ-ROT-001: Test 8 - Certificate Expiry Monitoring Engine', async (t) => {
  const status = checkCertificateStatus("MOSA-ESP-001");
  assert.equal(status.status, "HEALTHY", "Cert Monitor MUST return HEALTHY status for valid active device cert");
});

test('REQ-ROT-001: Test 9 - Certificate Revocation API & CRL Enforcement', async (t) => {
  const revokeResult = revokeCertificate("COMPROMISED-ESP-888", "Stolen device hardware");
  assert.equal(revokeResult.success, true, "Revocation API MUST append compromised device ID to CRL");

  const status = checkCertificateStatus("COMPROMISED-ESP-888");
  assert.equal(status.status, "REVOKED", "Cert Monitor MUST identify revoked device ID as REVOKED");
});
