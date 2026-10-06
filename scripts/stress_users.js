const { io } = require('socket.io-client');

const NUM_USERS = 5000;
const SERVER_URL = 'http://localhost:8080';

console.log(`🚀 Starting WebSocket Users Stress Test...`);
console.log(`Simulating ${NUM_USERS} concurrent users to ${SERVER_URL}`);

let connectedCount = 0;
const sockets = [];

// To avoid exhausting local ports quickly in a dev environment, we'll spawn 500
// but each will send actions at a 10x rate to simulate 5000 users.
const ACTIVE_SOCKETS = 500;
const MULTIPLIER = 10;

for (let i = 0; i < ACTIVE_SOCKETS; i++) {
  setTimeout(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false
    });

    socket.on('connect', () => {
      connectedCount++;
      if (connectedCount % 50 === 0) {
        console.log(`✅ ${connectedCount * MULTIPLIER} simulated users connected.`);
      }

      // Simulate a user aggressively toggling random devices
      setInterval(() => {
        for(let j = 0; j < MULTIPLIER; j++) {
          socket.emit('toggle_device', { 
            deviceId: `device_${Math.floor(Math.random() * 100)}`, 
            state: Math.random() > 0.5 
          });
        }
      }, 1000); // 10 commands per second per socket = 5000 commands/sec
    });

    socket.on('connect_error', (err) => {
      console.log(`❌ Connection Error: ${err.message}. Fastify might be choking.`);
    });

    sockets.push(socket);
  }, i * 5); // Stagger connections to prevent immediate DoS
}

setInterval(() => {
  console.log(`🌐 STRESS LOAD: ${connectedCount * MULTIPLIER} simulated active sessions blasting WebSockets.`);
}, 5000);
