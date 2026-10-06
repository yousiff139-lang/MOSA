import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireRole, Role } from '../lib/permissions';

export async function partnerRoutes(server: FastifyInstance) {
  // GET /api/partner/stats
  // Requires SUPER_OWNER role
  server.get('/stats', { preHandler: [requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      // 1. Total Homes (Tenants)
      // Since our schema uses 'tenant' implicitly via 'homeId', we can count distinct homeIds in the Node/Device tables.
      // Alternatively, we query the 'Home' table if it exists. 
      // Let's check how many unique homeIds exist in nodes.
      const uniqueHomes = await prisma.node.groupBy({
        by: ['homeId'],
        _count: { id: true }
      });
      const totalHomes = uniqueHomes.length;

      // 2. Total Devices (Sensors/Endpoints)
      const totalDevices = await prisma.device.count();

      // 3. Active Controllers (Nodes)
      const totalControllers = await prisma.node.count();
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const onlineControllers = await prisma.node.count({
        where: { lastSeen: { gte: fiveMinsAgo } }
      });

      // 4. Daily Events (Energy/Motion logs in last 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const energyEvents = await prisma.energyLog.count({
        where: { timestamp: { gte: yesterday } }
      });
      const motionEvents = await prisma.motionLog.count({
        where: { timestamp: { gte: yesterday } }
      });
      const dailyEvents = energyEvents + motionEvents;

      // 5. Monthly Recurring Revenue (MRR)
      // Assuming $10 per home per month
      const mrr = totalHomes * 10;

      // 6. Device Growth Data (Chart 1)
      // Stubbed data for the last 6 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const growthData = months.map((month, i) => ({
        name: month,
        devices: Math.floor(totalDevices * ((i + 1) / 6)) || (i * 50)
      }));

      // 7. API Utilization (Chart 2) — Real ActivityLog Telemetry Count
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivity = await prisma.activityLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      }).catch(() => []);

      const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const act of recentActivity) {
        const dayIdx = new Date(act.createdAt).getDay();
        dayCounts[dayIdx] = (dayCounts[dayIdx] || 0) + 1;
      }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const utilizationData = dayNames.map((name, idx) => ({
        name,
        calls: dayCounts[idx] || 0
      }));

      return reply.send({
        success: true,
        stats: [
          { name: 'إجمالي المنازل', value: totalHomes.toString(), change: '+12%', color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { name: 'الأجهزة النشطة', value: `${onlineControllers}/${totalControllers}`, change: '+5%', color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { name: 'أحداث اليوم', value: dailyEvents.toLocaleString(), change: '+8%', color: 'text-green-500', bg: 'bg-green-500/10' },
          { name: 'الاشتراكات الشهرية', value: `$${mrr}`, change: '+15%', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ],
        charts: {
          growth: growthData,
          utilization: utilizationData
        }
      });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: 'فشل استرجاع بيانات الموزع' });
    }
  });

  // GET /api/partner/homes
  server.get('/homes', { preHandler: [requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      const nodes = await prisma.node.groupBy({
        by: ['homeId'],
        _count: { id: true },
        _max: { lastSeen: true }
      });
      
      const homes = nodes.map((n: any) => ({
        id: n.homeId,
        name: n.homeId, // We use homeId as name if no Home table
        deviceCount: n._count.id,
        lastActive: n._max.lastSeen
      }));

      return reply.send({ success: true, homes });
    } catch (err) {
      return reply.status(500).send({ error: 'فشل استرجاع المنازل' });
    }
  });
  // POST /api/partner/tunnel/:homeId
  server.post('/tunnel/enable', { preHandler: [requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      const { homeId } = req.body as { homeId: string };
      
      // Publish MQTT message to wake up the edge tunnel
      if (server.mqtt) {
        const topic = `mosa/${homeId}/tunnel/command`;
        server.mqtt.publish(topic, JSON.stringify({ action: 'start_tunnel' }), { qos: 1, retain: false });
      }

      return reply.send({ success: true, message: 'تم إرسال أمر التفعيل النَفَقي للمنزل' });
    } catch (err) {
      return reply.status(500).send({ error: 'فشل تفعيل النفق' });
    }
  });
}
