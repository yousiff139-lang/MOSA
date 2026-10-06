const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const URL = process.env.API_URL || 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_prod';

const NUM_CLIENTS = 1000;
const EMISSION_INTERVAL = 5000; // Emit every 5 seconds per client

console.log(`🚀 Starting MOSA Enterprise Load Test...`);
console.log(`Target: ${URL}`);
console.log(`Simulated Concurrent Users: ${NUM_CLIENTS}`);

let connectedCount = 0;
let messageCount = 0;
let errors = 0;

// Create a valid JWT payload so Fastify socket auth accepts it
const token = jwt.sign({ 
    id: 'user_loadtest_123', 
    activeHomeId: 'home_loadtest_999' 
}, JWT_SECRET);

const clients = [];

async function start() {
    console.log(`[1] Spinning up ${NUM_CLIENTS} WebSocket clients...`);
    
    for (let i = 0; i < NUM_CLIENTS; i++) {
        const socket = io(URL, {
            auth: { token },
            transports: ['websocket'],
            reconnection: false
        });

        socket.on('connect', () => {
            connectedCount++;
            if (connectedCount % 100 === 0) {
                console.log(`🟢 ${connectedCount} clients connected...`);
            }
        });

        socket.on('connect_error', (err) => {
            errors++;
        });

        socket.on('disconnect', () => {
            connectedCount--;
        });

        clients.push(socket);
        
        // Stagger connections slightly so we don't blow up the Node event loop instantly
        await new Promise(r => setTimeout(r, 2));
    }

    console.log(`\n[2] All clients initiated. Starting message blast phase...`);
    
    // Have each client randomly emit device:action commands
    setInterval(() => {
        const activeClients = clients.filter(c => c.connected);
        console.log(`📊 Stats | Active Connections: ${activeClients.length} | Errors: ${errors} | Messages Sent: ${messageCount}`);
        
        activeClients.forEach(client => {
            // Give each client a random 10% chance per second to click a button
            if (Math.random() < 0.1) {
                client.emit('device:action', { 
                    deviceId: 'device_test_1', 
                    action: { isOn: Math.random() > 0.5 } 
                });
                messageCount++;
            }
        });
    }, 1000); // Check every second

    // Stop test after 30 seconds
    setTimeout(() => {
        console.log(`\n🛑 Test completed.`);
        console.log(`Final Stats:`);
        console.log(`- Peak Connections: ${connectedCount}`);
        console.log(`- Total Actions Emitted: ${messageCount}`);
        console.log(`- Connection Errors: ${errors}`);
        process.exit(0);
    }, 30000);
}

start();
