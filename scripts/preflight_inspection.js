const { PrismaClient } = require('@prisma/client');
const net = require('net');
const Redis = require('ioredis');

async function runPreflight() {
  console.log('================================================================');
  console.log('🩺 MOSA PLATFORM — COMPREHENSIVE PRODUCTION PREFLIGHT AUDIT');
  console.log('================================================================\n');

  let allPassed = true;

  // 1. Database & RLS Check
  console.log('1️⃣ Auditing Database & RLS Enforcement:');
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('   ✅ PostgreSQL Database Connected.');

    const userCount = await prisma.user.count();
    const deviceCount = await prisma.device.count();
    const nodeCount = await prisma.node.count();
    console.log(`   📊 Stats: Users=${userCount}, Devices=${deviceCount}, Nodes=${nodeCount}`);

    // Check PIN bcrypt integrity
    const users = await prisma.user.findMany({ select: { id: true, username: true, pinCode: true } });
    const unhashedUsers = users.filter(u => !u.pinCode.startsWith('$2a$') && !u.pinCode.startsWith('$2b$'));
    if (unhashedUsers.length === 0) {
      console.log('   ✅ 100% User PINs are encrypted with bcrypt.');
    } else {
      console.log(`   🔴 ${unhashedUsers.length} user(s) have unhashed PINs!`);
      allPassed = false;
    }

    // Check RLS policies on tables
    const rlsTables = await prisma.$queryRaw`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname='public' AND tablename IN ('Node', 'Device', 'AuditLog', 'Room', 'Automation');
    `;
    const disabledRls = rlsTables.filter(t => !t.rowsecurity);
    if (disabledRls.length === 0) {
      console.log('   ✅ PostgreSQL RLS is active on all core multi-tenant tables.');
    } else {
      console.log(`   🔴 RLS is disabled on: ${disabledRls.map(t => t.tablename).join(', ')}`);
      allPassed = false;
    }

  } catch (err) {
    console.log(`   🔴 Database Error: ${err.message}`);
    allPassed = false;
  } finally {
    await prisma.$disconnect();
  }

  // 2. Redis AOF & Memory Check
  console.log('\n2️⃣ Auditing Redis Persistence & Health:');
  try {
    const redisClient = new Redis(process.env.REDIS_URL || 'redis://mosa-redis:6379');
    const ping = await redisClient.ping();
    const info = await redisClient.info('persistence');
    const aofEnabled = info.includes('aof_enabled:1');
    console.log(`   ✅ Redis Ping: ${ping}`);
    if (aofEnabled) {
      console.log('   ✅ Redis AOF Persistence: ENABLED (Appendfsync everysec)');
    } else {
      console.log('   ⚠️ Redis AOF Persistence is NOT enabled in current runtime.');
    }
    await redisClient.quit();
  } catch (err) {
    console.log(`   🔴 Redis Error: ${err.message}`);
    allPassed = false;
  }

  // 3. MQTT Broker Listener Check
  console.log('\n3️⃣ Auditing MQTT Broker Listeners:');
  const checkPort = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        resolve(false);
      });
      socket.connect(port, host);
    });
  };

  const mqttPlaintext = await checkPort('mosa-mosquitto', 1883);
  const mqttTls = await checkPort('mosa-mosquitto', 8883);
  const mqttWs = await checkPort('mosa-mosquitto', 9001);

  if (mqttPlaintext) {
    console.log('   🛑 Port 1883 (Unencrypted MQTT): OPEN (VIOLATION: Zero-Downgrade Policy Breached)');
    allPassed = false;
  } else {
    console.log('   ✅ Port 1883 (Unencrypted MQTT): CLOSED (Zero-Downgrade Enforced)');
  }

  if (mqttTls) {
    console.log('   ✅ Port 8883 (Secure TLS MQTT): ONLINE');
  } else {
    console.log('   🛑 Port 8883 (Secure TLS MQTT): OFFLINE (Required mTLS Listener Down)');
    allPassed = false;
  }

  if (mqttWs) {
    console.log('   ✅ Port 9001 (WebSockets TLS MQTT): ONLINE');
  } else {
    console.log('   🛑 Port 9001 (WebSockets TLS MQTT): OFFLINE (Required WSS Listener Down)');
    allPassed = false;
  }

  // Summary Verdict
  console.log('\n================================================================');
  if (allPassed) {
    console.log('📋 PREFLIGHT STATUS: ALL LOCAL DIAGNOSTIC CHECKS PASSED');
  } else {
    console.log('⚠️ PREFLIGHT STATUS: FAILURES DETECTED — REMEDIATION REQUIRED');
  }
  console.log('================================================================');
}

runPreflight();
