const mqtt = require('mqtt');

// Configuration
const BROKER_URL = 'mqtt://127.0.0.1:1883';
const CLIENTS_COUNT = 90; // 90 concurrent nodes
const MESSAGES_PER_CLIENT_PER_SEC = 1;
const DURATION_SEC = 60;

const clients = [];
let totalMessagesSent = 0;

console.log(`🚀 Starting MQTT Stress Test...`);
console.log(`- Nodes: ${CLIENTS_COUNT}`);
console.log(`- Frequency: ${MESSAGES_PER_CLIENT_PER_SEC} msg/sec per node`);
console.log(`- Duration: ${DURATION_SEC} seconds`);

// Connect clients
for (let i = 0; i < CLIENTS_COUNT; i++) {
  const homeId = `home_stress`;
  const deviceId = `node_${i}`;
  const client = mqtt.connect(BROKER_URL, {
    clientId: `stress_client_${i}`,
    username: 'admin',
    password: 'adminpassword',
    reconnectPeriod: 1000
  });

  client.on('connect', () => {
    clients.push({ client, homeId, deviceId });
  });

  client.on('error', (err) => {
    console.error(`Client ${i} error:`, err.message);
  });
}

// Start publishing loop
setTimeout(() => {
  if (clients.length < CLIENTS_COUNT) {
    console.warn(`⚠️ Only ${clients.length}/${CLIENTS_COUNT} clients connected successfully. Continuing...`);
  } else {
    console.log(`✅ All ${CLIENTS_COUNT} clients connected.`);
  }

  const interval = setInterval(() => {
    clients.forEach(({ client, homeId, deviceId }) => {
      const topic = `mosa/${homeId}/${deviceId}/telemetry`;
      const payload = JSON.stringify({
        energy: { power: Math.floor(Math.random() * 500) + 10 },
        motion: { presence: Math.random() > 0.5 }
      });

      client.publish(topic, payload, { qos: 0 }, (err) => {
        if (!err) totalMessagesSent++;
      });
    });
  }, 1000 / MESSAGES_PER_CLIENT_PER_SEC);

  // Stop after DURATION_SEC
  setTimeout(() => {
    clearInterval(interval);
    console.log(`\n🛑 Test completed!`);
    console.log(`📊 Total messages sent: ${totalMessagesSent}`);
    console.log(`📊 Expected total: ${CLIENTS_COUNT * MESSAGES_PER_CLIENT_PER_SEC * DURATION_SEC}`);
    
    // Disconnect
    clients.forEach(c => c.client.end());
    process.exit(0);
  }, DURATION_SEC * 1000);

}, 2000); // Wait 2 seconds for connections to establish
