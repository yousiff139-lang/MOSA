/**
 * Native Docker Network Scale Diagnostic
 * Runs inside Docker network (connecting directly to mosa-mosquitto:1883)
 * to eliminate the Docker Desktop Windows localhost userland proxy bottleneck.
 */

const mqtt = require('mqtt');
const crypto = require('crypto');

async function testDockerInternalCapacity(targetCount = 5000) {
  console.log(`[Docker-Internal Benchmark] Connecting ${targetCount} clients to mqtt://mosa-mosquitto:1883 directly...`);

  const errorBuckets = {
    SUCCESS: 0,
    ECONNRESET: 0,
    ECONNREFUSED: 0,
    EMFILE_ENFILE: 0,
    ETIMEDOUT: 0,
    CONNACK_TIMEOUT: 0,
    OTHER: 0
  };

  const clients = [];
  const batchSize = 250;

  for (let i = 0; i < targetCount; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, targetCount - i) }, (_, idx) => i + idx);
    await Promise.all(batch.map((idx) => {
      return new Promise((resolve) => {
        const client = mqtt.connect('mqtt://mosa-mosquitto:1883', {
          clientId: `internal_node_${idx}_${crypto.randomBytes(2).toString('hex')}`,
          username: 'mosa_device',
          password: 'mosa_mqtt_secret',
          connectTimeout: 5000,
          reconnectPeriod: 0
        });

        let done = false;
        client.on('connect', () => {
          if (!done) {
            done = true;
            errorBuckets.SUCCESS++;
            clients.push(client);
            resolve();
          }
        });

        client.on('error', (err) => {
          if (!done) {
            done = true;
            const code = err.code || err.message;
            if (code === 'ECONNRESET') errorBuckets.ECONNRESET++;
            else if (code === 'ECONNREFUSED') errorBuckets.ECONNREFUSED++;
            else if (code === 'EMFILE' || code === 'ENFILE') errorBuckets.EMFILE_ENFILE++;
            else errorBuckets.OTHER++;
            resolve();
          }
        });

        setTimeout(() => {
          if (!done) {
            done = true;
            errorBuckets.ETIMEDOUT++;
            resolve();
          }
        }, 5500);
      });
    }));
    await new Promise(r => setTimeout(r, 20));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 DOCKER INTERNAL NETWORK RESULTS (${targetCount} Connection Attempts)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  • ✅ Successful Connections:        ${errorBuckets.SUCCESS} / ${targetCount} (${((errorBuckets.SUCCESS/targetCount)*100).toFixed(1)}%)`);
  console.log(`  • 🛑 ECONNRESET (Proxy Reset):     ${errorBuckets.ECONNRESET}`);
  console.log(`  • 🛑 ECONNREFUSED:                 ${errorBuckets.ECONNREFUSED}`);
  console.log(`  • 🛑 EMFILE/ENFILE:                ${errorBuckets.EMFILE_ENFILE}`);
  console.log(`  • 🛑 Timeout:                      ${errorBuckets.ETIMEDOUT}`);
  console.log(`  • 🛑 Other:                        ${errorBuckets.OTHER}`);

  for (const c of clients) {
    try { c.end(true); } catch (_) {}
  }
}

testDockerInternalCapacity(5000).catch(console.error);
