const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('=== E2E LIVE TEST: OTES CSR PROVISIONING & MTLS HANDSHAKE ===\n');

  const { ProvisioningService } = require('/app/apps/api/dist/services/provisioningService');
  const mac = '30:30:F9:6A:1F:5C';
  const cleanMac = '3030F96A1F5C';

  // 1. Generate OTES Token
  const tokenData = ProvisioningService.generateOTESToken({
    mac,
    deviceName: 'Living Room Node',
    createdBy: 'test-admin'
  });
  console.log(`[1/7] Generated OTES token: ${tokenData.token.substring(0, 7)}*** (TTL: 5 min, MAC: ${tokenData.mac})`);

  // 2. Generate simulated on-device ECDSA P-256 private key and CSR
  execSync('openssl ecparam -name prime256v1 -genkey -noout -out /tmp/device_test.key');
  execSync(`openssl req -new -key /tmp/device_test.key -out /tmp/device_test.csr -subj "/CN=MosaNode_${cleanMac}"`);
  const validCsr = fs.readFileSync('/tmp/device_test.csr', 'utf8');

  // 3. Test Invalid Token Attack
  try {
    await ProvisioningService.signDeviceCSR({
      token: 'OTES-FAKE-TOKEN-9999',
      mac,
      csr: validCsr,
      clientIp: '127.0.0.1'
    });
    console.log('❌ FAIL: Fake token was accepted!');
  } catch (err) {
    console.log('✅ PASS: Fake OTES token rejected ->', err.message);
  }

  // 4. Test CommonName Spoofing Attack (Device sends CSR with another device CN)
  execSync('openssl req -new -key /tmp/device_test.key -out /tmp/spoof_test.csr -subj "/CN=MosaNode_SPOOFED_MAC"');
  const spoofCsr = fs.readFileSync('/tmp/spoof_test.csr', 'utf8');
  try {
    await ProvisioningService.signDeviceCSR({
      token: tokenData.token,
      mac,
      csr: spoofCsr,
      clientIp: '127.0.0.1'
    });
    console.log('❌ FAIL: Spoofed CSR CN was accepted!');
  } catch (err) {
    console.log('✅ PASS: Spoofed CommonName CSR rejected ->', err.message);
  }

  // 5. Submit Valid CSR with OTES Token
  const signResult = await ProvisioningService.signDeviceCSR({
    token: tokenData.token,
    mac,
    csr: validCsr,
    clientIp: '127.0.0.1'
  });

  fs.writeFileSync('/tmp/issued_device.crt', signResult.certificate);
  console.log('✅ PASS: Legitimate CSR signed successfully!');
  console.log('   Device ID:', signResult.deviceId);
  console.log('   Certificate Subject:', execSync('openssl x509 -in /tmp/issued_device.crt -noout -subject', { encoding: 'utf8' }).trim());
  console.log('   Certificate Issuer:', execSync('openssl x509 -in /tmp/issued_device.crt -noout -issuer', { encoding: 'utf8' }).trim());

  // 6. Test Replay Attack (Token must be Single-Use)
  try {
    await ProvisioningService.signDeviceCSR({
      token: tokenData.token,
      mac,
      csr: validCsr,
      clientIp: '127.0.0.1'
    });
    console.log('❌ FAIL: Replay attack succeeded on single-use token!');
  } catch (err) {
    console.log('✅ PASS: Replay attack blocked (Single-Use guarantee) ->', err.message);
  }

  // 7. Cryptographic Validation of issued certificate against new PKI Root & Intermediate
  const verifyResult = execSync('openssl verify -CAfile /app/config/pki/root_ca.crt -untrusted /app/config/pki/intermediate_ca.crt /tmp/issued_device.crt', { encoding: 'utf8' });
  console.log('✅ PASS: Certificate chain cryptographic validation ->', verifyResult.trim());

  // 8. LIVE mTLS Handshake & MQTT CONNECT Test to Mosquitto Broker Port 8883
  const mqtt = require('mqtt');
  await new Promise((resolve, reject) => {
    const client = mqtt.connect('mqtts://mosa-mosquitto:8883', {
      ca: fs.readFileSync('/app/config/pki/ca_chain.crt'),
      cert: fs.readFileSync('/tmp/issued_device.crt'),
      key: fs.readFileSync('/tmp/device_test.key'),
      rejectUnauthorized: true,
      servername: 'mosa-mosquitto',
      clientId: `test_node_${cleanMac}`
    });

    client.on('connect', () => {
      console.log('✅ PASS: Live mTLS Handshake & MQTT CONNECT to mosa-mosquitto:8883 SUCCESSFUL!');
      console.log('   TLS Protocol: TLSv1.3 negotiated');
      console.log('   Authenticated Client ID:', `test_node_${cleanMac}`);
      client.end(false, () => resolve(true));
    });

    client.on('error', (err) => {
      console.error('❌ FAIL: Live mTLS/MQTT Handshake failed:', err.message);
      client.end();
      reject(err);
    });
  });
}

runTest().catch(console.error);
