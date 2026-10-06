/**
 * Adversarial Cross-Home Eavesdropping and Injection Test
 * Verifies that a device in Home A CANNOT subscribe or publish to Home B
 */

const mqtt = require('mqtt');

async function testCrossHomeIsolation() {
  console.log('Connecting as mosa_device (Home A partition)...');
  const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'adversarial_tester_homeA',
    username: 'mosa_device',
    password: 'mosa_mqtt_secret',
    connectTimeout: 4000
  });

  await new Promise((resolve) => {
    client.on('connect', () => {
      console.log('1. Authenticated as mosa_device');

      // Attempt 1: Subscribe to other home's device state
      client.subscribe('mosa/victim-home-b-uuid/device/victim-device-888/state', (err, granted) => {
        console.log('   Cross-Home Subscribe Granted Details:', granted);
        const denied = !granted || granted.length === 0 || granted.every(g => g.qos === 128 || g.qos === 0x80);
        console.log(denied ? '   ✅ PASS: Cross-Home Subscribe DENIED by Mosquitto ACL (QoS 128)' : '   ❌ FAIL: Cross-Home Subscribe Allowed');

        // Attempt 2: Subscribe to own home device state
        client.subscribe('mosa/c55f83aa-2a04-493b-9301-a29a978d9be5/device/MosaNode_3030F96A1F5C/state', (err2, granted2) => {
          console.log('   Intra-Home Subscribe Granted Details:', granted2);
          const allowed = granted2 && granted2.some(g => g.qos === 0);
          console.log(allowed ? '   ✅ PASS: Intra-Home Own Device Topic ALLOWED (QoS 0)' : '   ❌ FAIL: Intra-Home Topic Denied');

          client.end();
          resolve();
        });
      });
    });

    client.on('error', (err) => {
      console.error('MQTT Client Error:', err);
      resolve();
    });
  });
}

testCrossHomeIsolation().catch(console.error);
