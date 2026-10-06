const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://localhost:1883';
const NUM_DEVICES = 1000;
const MESSAGES_PER_MINUTE = 10; // Total 10,000 msgs/min

console.log(`Starting MQTT Stress Test: ${NUM_DEVICES} devices...`);

const clients = [];

for (let i = 0; i < NUM_DEVICES; i++) {
  const client = mqtt.connect(BROKER_URL, {
    clientId: `stress_device_${i}`,
    username: 'admin',
    password: 'adminpassword'
  });

  client.on('connect', () => {
    // Send periodic telemetry
    setInterval(() => {
      const topic = `mosa/home1/device/stress_${i}/state`;
      const payload = JSON.stringify({
        temperature: 20 + Math.random() * 10,
        power: Math.random() * 100,
        state: Math.random() > 0.5 ? 'ON' : 'OFF'
      });
      client.publish(topic, payload);
    }, (60000 / MESSAGES_PER_MINUTE) + Math.random() * 1000);
  });

  client.on('error', (err) => {
    // Handle overload errors silently
  });

  clients.push(client);
}
