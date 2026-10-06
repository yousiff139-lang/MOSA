/**
 * Detailed Error Classification & Failure Mode Diagnostics (Step 3)
 */

const mqtt = require('mqtt');
const crypto = require('crypto');

async function diagnoseFailureModes(targetCount = 5000) {
  console.log(`[Diagnostic] Connecting ${targetCount} clients and categorizing error signatures...`);
  
  const errorBuckets = {
    ECONNREFUSED: 0,
    EMFILE_ENFILE: 0,
    ETIMEDOUT: 0,
    EADDRINUSE_EADDRNOTAVAIL: 0,
    CONNACK_TIMEOUT: 0,
    NOT_AUTHORIZED: 0,
    OTHER: 0,
    SUCCESS: 0
  };

  const errorDetails = {};
  const clients = [];

  const batchSize = 250;
  for (let i = 0; i < targetCount; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, targetCount - i) }, (_, idx) => i + idx);
    await Promise.all(batch.map((clientIdx) => {
      return new Promise((resolve) => {
        const client = mqtt.connect('mqtt://localhost:1883', {
          clientId: `diag_client_${clientIdx}_${crypto.randomBytes(2).toString('hex')}`,
          username: 'mosa_device',
          password: 'mosa_mqtt_secret',
          connectTimeout: 4000,
          reconnectPeriod: 0
        });

        let isDone = false;

        client.on('connect', () => {
          if (!isDone) {
            isDone = true;
            errorBuckets.SUCCESS++;
            clients.push(client);
            resolve();
          }
        });

        client.on('error', (err) => {
          if (!isDone) {
            isDone = true;
            const code = err.code || err.message;
            errorDetails[code] = (errorDetails[code] || 0) + 1;

            if (code === 'ECONNREFUSED' || (err.message && err.message.includes('ECONNREFUSED'))) {
              errorBuckets.ECONNREFUSED++;
            } else if (code === 'EMFILE' || code === 'ENFILE') {
              errorBuckets.EMFILE_ENFILE++;
            } else if (code === 'ETIMEDOUT' || (err.message && err.message.includes('ETIMEDOUT'))) {
              errorBuckets.ETIMEDOUT++;
            } else if (code === 'EADDRINUSE' || code === 'EADDRNOTAVAIL' || (err.message && err.message.includes('EADDR'))) {
              errorBuckets.EADDRINUSE_EADDRNOTAVAIL++;
            } else if (err.message && err.message.includes('connack timeout')) {
              errorBuckets.CONNACK_TIMEOUT++;
            } else if (err.message && err.message.includes('not authorised')) {
              errorBuckets.NOT_AUTHORIZED++;
            } else {
              errorBuckets.OTHER++;
            }
            resolve();
          }
        });

        setTimeout(() => {
          if (!isDone) {
            isDone = true;
            errorBuckets.ETIMEDOUT++;
            errorDetails['TIMEOUT_NO_CALLBACK'] = (errorDetails['TIMEOUT_NO_CALLBACK'] || 0) + 1;
            resolve();
          }
        }, 4500);
      });
    }));
    await new Promise(r => setTimeout(r, 20));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 FAILURE MODE ERROR BREAKDOWN (${targetCount} Connection Attempts)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  • ✅ Successful Connections:           ${errorBuckets.SUCCESS}`);
  console.log(`  • 🛑 ECONNREFUSED (Broker Rejected):    ${errorBuckets.ECONNREFUSED}`);
  console.log(`  • 🛑 EMFILE / ENFILE (Descriptor Cap): ${errorBuckets.EMFILE_ENFILE}`);
  console.log(`  • 🛑 EADDRINUSE / Ephemeral Exhausted: ${errorBuckets.EADDRINUSE_EADDRNOTAVAIL}`);
  console.log(`  • 🛑 Connack Timeout (Queue Overload): ${errorBuckets.CONNACK_TIMEOUT}`);
  console.log(`  • 🛑 Connect Timeout (Socket Stalled): ${errorBuckets.ETIMEDOUT}`);
  console.log(`  • 🛑 Not Authorized:                   ${errorBuckets.NOT_AUTHORIZED}`);
  console.log(`  • 🛑 Other Errors:                     ${errorBuckets.OTHER}`);
  console.log('\nRaw Error Signatures Captured:');
  console.log(JSON.stringify(errorDetails, null, 2));

  // Teardown
  for (const c of clients) {
    try { c.end(true); } catch (_) {}
  }
}

diagnoseFailureModes(5000).catch(console.error);
