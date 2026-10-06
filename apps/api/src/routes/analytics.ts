import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { redisClient } from '../server';

export const analyticsRoutes = async (server: FastifyInstance) => {
  server.addHook('preHandler', verifyTenant);

  // GET /api/analytics/summary - Real Database Energy Monitoring Metrics
  server.get('/summary', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;

    try {
      const logs = await prisma.energyLog.findMany({
        where: {
          device: { homeId }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000,
        include: { device: { include: { node: true } } }
      });

      let currentLoadW = 0;
      if (logs.length > 0) {
        currentLoadW = logs[0].powerW || 0;
      }
      const currentLoadKW = (currentLoadW / 1000).toFixed(2);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayLogs = logs.filter(l => new Date(l.timestamp) >= startOfDay);
      const todayPowerSumW = todayLogs.reduce((acc, l) => acc + (l.powerW || 0), 0);
      const todayKWh = (todayPowerSumW / 1000 * (1 / 60)).toFixed(2);

      const voltageV = currentLoadW > 0 ? 220 : 0;
      const currentA = currentLoadW > 0 ? (currentLoadW / 220).toFixed(1) : '0.0';

      // Build real chart data (7 time buckets)
      const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
      const chartData = hours.map((h, i) => {
        const bucketStartHour = i * 4;
        const bucketEndHour = (i + 1) * 4;
        const bucketLogs = logs.filter(l => {
          const hour = new Date(l.timestamp).getHours();
          return hour >= bucketStartHour && hour < bucketEndHour;
        });
        const avgW = bucketLogs.length > 0
          ? bucketLogs.reduce((sum, l) => sum + (l.powerW || 0), 0) / bucketLogs.length
          : 0;
        return {
          time: h,
          value: parseFloat((avgW / 1000).toFixed(2))
        };
      });

      // Format 10 recent table rows
      const tableLogs = logs.slice(0, 10).map(l => {
        const pW = l.powerW || 0;
        const cA = pW > 0 ? (pW / 220).toFixed(1) : '0.0';
        const vV = pW > 0 ? '220.0' : '0.0';
        return {
          id: l.id,
          time: new Date(l.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          meterName: l.device ? (l.device.node ? l.device.node.name : l.device.name) : 'ESP32_MAIN_POWER_METER',
          voltage: `${vV} V`,
          current: `${cA} A`,
          power: `${(pW / 1000).toFixed(2)} kW`,
          status: pW > 0 ? 'نشط مستمر' : 'متوقف / خامل'
        };
      });

      return reply.send({
        currentLoadKW,
        todayKWh,
        voltageV,
        currentA,
        chartData,
        logs: tableLogs
      });
    } catch (e: any) {
      server.log.error(e, 'Failed to fetch analytics summary');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /api/analytics/report-stats - Real Report Analytics from DB
  server.get('/report-stats', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const { duration = 'MONTH', room = 'ALL', unitPrice = '0.05' } = req.query as { duration?: string; room?: string; unitPrice?: string };

    try {
      const price = parseFloat(unitPrice) || 0.05;
      const now = new Date();
      let days = 30;
      if (duration === 'WEEK') days = 7;
      if (duration === '2MONTHS') days = 60;
      if (duration === '6MONTHS') days = 180;
      if (duration === 'YEAR') days = 365;

      const fromDate = new Date();
      fromDate.setDate(now.getDate() - days);

      const whereClause: any = {
        device: { homeId },
        timestamp: { gte: fromDate }
      };

      if (room !== 'ALL') {
        whereClause.device.room = { name: room };
      }

      const logs = await prisma.energyLog.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' }
      });

      const totalPowerSumW = logs.reduce((acc, l) => acc + (l.powerW || 0), 0);
      const totalKWh = Math.round((totalPowerSumW / 1000 * (1 / 60)));
      const calculatedCost = (totalKWh * price).toFixed(2);
      const avgPower = logs.length > 0 ? Math.round(totalPowerSumW / logs.length) : 0;

      // Group into bars based on duration
      let chartBars: Array<{ label: string; value: number; percent: number }> = [];

      if (duration === 'WEEK') {
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const grouped: Record<string, number[]> = {};
        dayNames.forEach(d => { grouped[d] = []; });
        logs.forEach(l => {
          const dName = dayNames[new Date(l.timestamp).getDay()];
          if (grouped[dName]) grouped[dName].push(l.powerW || 0);
        });
        chartBars = dayNames.map(d => {
          const vals = grouped[d];
          const val = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return { label: d, value: val, percent: 0 };
        });
      } else {
        const weeks = ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'];
        const grouped: Record<string, number[]> = {};
        weeks.forEach(w => { grouped[w] = []; });
        logs.forEach(l => {
          const dayOfMonth = new Date(l.timestamp).getDate();
          const wIdx = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
          grouped[weeks[wIdx]].push(l.powerW || 0);
        });
        chartBars = weeks.map(w => {
          const vals = grouped[w];
          const val = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return { label: w, value: val, percent: 0 };
        });
      }

      const maxVal = Math.max(10, ...chartBars.map(c => c.value));
      chartBars = chartBars.map(c => ({
        ...c,
        percent: maxVal > 0 ? (c.value / maxVal) * 100 : 0
      }));

      return reply.send({
        totalKWh,
        calculatedCost,
        avgPower,
        chartBars
      });
    } catch (e: any) {
      server.log.error(e, 'Failed to fetch report stats');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  server.get('/hourly', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const { nodeId, days } = req.query as { nodeId?: string, days?: string };
    
    const cacheKey = `analytics_${homeId}_${nodeId || 'all'}_${days || '7'}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return reply.send(JSON.parse(cached));
      }
    } catch (e) {
      server.log.warn('Redis cache offline. Fetching from DB directly.');
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(days || '7', 10));

    const data = await prisma.energyLog.findMany({
      where: {
        device: { homeId },
        ...(nodeId && { deviceId: nodeId }),
        timestamp: { gte: fromDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    const grouped: any = {};
    data.forEach((d: any) => {
       const hour = d.timestamp.toISOString().substring(0, 13) + ':00:00.000Z';
       if (!grouped[hour]) grouped[hour] = { powerSum: 0, count: 0 };
       grouped[hour].powerSum += d.powerW || 0;
       grouped[hour].count++;
    });

    const result = Object.keys(grouped).map(hour => ({
       bucket: hour,
       avg_power: grouped[hour].powerSum / grouped[hour].count
    }));

    try {
      await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 900);
    } catch (e) {
      server.log.warn('Failed to cache analytics to Redis.');
    }

    return reply.send(result);
  });

  server.get('/daily', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const { days } = req.query as { days?: string };
    
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(days || '30', 10));

    const data = await prisma.energyLog.findMany({
      where: {
        device: { homeId },
        timestamp: { gte: fromDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    const grouped: any = {};
    data.forEach((d: any) => {
       const day = d.timestamp.toISOString().substring(0, 10);
       if (!grouped[day]) grouped[day] = { powerSum: 0, count: 0 };
       grouped[day].powerSum += d.powerW || 0;
       grouped[day].count++;
    });

    const result = Object.keys(grouped).map(day => ({
       bucket: day,
       avg_power: grouped[day].powerSum / grouped[day].count,
       max_power: Math.max(...data.filter((x:any) => x.timestamp.toISOString().startsWith(day)).map((x:any) => x.powerW || 0))
    }));

    return reply.send(result);
  });

  server.get('/export', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    
    const data = await prisma.energyLog.findMany({
      where: { device: { homeId } },
      orderBy: { timestamp: 'asc' },
      take: 10000
    });

    let csv = 'Timestamp,DeviceId,PowerW\n';
    data.forEach(d => {
      csv += `${d.timestamp.toISOString()},${d.deviceId},${d.powerW || 0}\n`;
    });

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="analytics_export.csv"');
    return reply.send(csv);
  });

  server.get('/business', { preHandler: [requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      const activeHomes = await prisma.home.count();
      const totalDevices = await prisma.device.count();
      const totalAutomations = await prisma.automation.count();
      const totalUsers = await prisma.user.count();

      const metrics = {
        activeHomes,
        totalDevices,
        totalAutomations,
        totalUsers,
        timestamp: new Date().toISOString()
      };

      return reply.send(metrics);
    } catch (e) {
      server.log.error(e, 'Failed to fetch business metrics');
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
};
