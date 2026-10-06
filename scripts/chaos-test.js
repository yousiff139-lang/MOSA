const { exec } = require('child_process');

const CONTAINERS = ['mosa-mosquitto', 'mosa-redis', 'mosa-postgres'];
const INTERVAL = 30000; // 30 seconds

console.log('🔥 Starting Chaos Engineering Suite 🔥');

setInterval(() => {
  const target = CONTAINERS[Math.floor(Math.random() * CONTAINERS.length)];
  console.log(`[CHAOS] Randomly killing ${target}...`);
  
  exec(`docker stop ${target}`, (err) => {
    if (err) return console.error(err);
    console.log(`[CHAOS] ${target} is down. Waiting 10 seconds before recovery...`);
    
    setTimeout(() => {
      console.log(`[CHAOS] Restarting ${target}...`);
      exec(`docker start ${target}`, (err) => {
        if (err) return console.error(err);
        console.log(`[CHAOS] ${target} recovered. Backend should auto-reconnect.`);
      });
    }, 10000);
  });
}, INTERVAL);
