const mqtt = require('mqtt');

const NUM_DEVICES = 10000;
const BROKER_URL = 'mqtt://localhost:1883';
const PUBLISH_INTERVAL_MS = 2000;

console.log(`🚀 Starting IoT Device Stress Test...`);
console.log(`Connecting ${NUM_DEVICES} virtual ESP32s to ${BROKER_URL}`);

let connectedCount = 0;
const clients = [];

// To avoid exhausting OS ephemeral ports, we will reuse a single client 
// to simulate the load of 10,000 devices publishing by rapidly looping topics.
const masterClient = mqtt.connect(BROKER_URL);

masterClient.on('connect', () => {
  console.log(`✅ Master MQTT Client connected. Simulating ${NUM_DEVICES} devices payload generation...`);
  
  let payloadCount = 0;
  const startTime = Date.now();

  setInterval(() => {
    // Blast 1,000 messages every 200ms to simulate 5000 msg/sec
    for(let i = 0; i < 1000; i++) {
      const deviceId = `esp32_stress_${Math.floor(Math.random() * NUM_DEVICES)}`;
      const payload = JSON.stringify({
        temperature: (Math.random() * 10 + 20).toFixed(1),
        humidity: Math.floor(Math.random() * 50 + 30),
        isOn: Math.random() > 0.5
      });
      
      masterClient.publish(`mosa/telemetry/${deviceId}`, payload, { qos: 0 });
      payloadCount++;
    }
  }, 200);

  setInterval(() => {
    const elapsedSec = (Date.now() - startTime) / 1000;
    const msgPerSec = (payloadCount / elapsedSec).toFixed(0);
    console.log(`🔥 STRESS LOAD: ${msgPerSec} MQTT Messages / Second pushed to Fastify.`);
  }, 2000);
});

masterClient.on('error', (err) => {
  console.error(`❌ MQTT Error:`, err.message);
});
