const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const NUM_DEVICES = parseInt(process.env.NUM_DEVICES, 10) || 10000;
const HOME_ID = 'stress-test-home';

console.log(`Starting Thundering Herd Simulator with ${NUM_DEVICES} devices to ${BROKER_URL}...`);

const clients = [];

// Simulate devices reconnecting over a short time window (e.g. 5 seconds after power restore)
const STAGGER_MS = 5000 / NUM_DEVICES; 

for (let i = 0; i < NUM_DEVICES; i++) {
  setTimeout(() => {
    const deviceId = `stress_device_${i}`;
    const client = mqtt.connect(BROKER_URL, {
      clientId: `sim_${deviceId}`,
      username: process.env.MQTT_USERNAME || 'mosa_sim',
      password: process.env.MQTT_PASSWORD || 'secret',
      reconnectPeriod: 1000,
    });

    client.on('connect', () => {
      // Upon connection, devices typically send a status online message and initial state
      client.publish(`mosa/${HOME_ID}/device/${deviceId}/status`, 'ONLINE');
      client.publish(`mosa/${HOME_ID}/device/${deviceId}/state`, JSON.stringify({
        temperature: 20 + Math.random() * 10,
        humidity: 40 + Math.random() * 20,
        power: 10 + Math.random() * 100,
        motion: Math.random() > 0.95
      }));
    });

    client.on('error', (err) => {
      console.error(`Device ${i} Error:`, err.message);
    });

    clients.push(client);

    if (i % 500 === 0 && i !== 0) {
      console.log(`Spawned ${i} devices...`);
    }

    if (i === NUM_DEVICES - 1) {
      console.log(`All ${NUM_DEVICES} simulated devices booted.`);
    }

  }, i * STAGGER_MS);
}

// Keep process alive
process.on('SIGINT', () => {
  console.log('Shutting down simulator...');
  clients.forEach(c => c.end());
  process.exit();
});
