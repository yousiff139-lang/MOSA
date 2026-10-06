import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const tariffSchema = z.object({
  energyTariff: z.number().min(0.1, 'التسعيرة يجب أن تكون أكبر من 0'),
  energyBudget: z.number().min(1, 'الميزانية يجب أن تكون أكبر من 0')
});

export async function energyRoutes(server: FastifyInstance) {
  const requestTracker = new Map<string, { count: number; resetTime: number }>();

  const rateLimiter = async (req: any, reply: any) => {
    const ip = req.ip;
    const now = Date.now();
    const limit = 30; // 30 requests per minute
    const windowMs = 60000;

    const record = requestTracker.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count++;
    }
    requestTracker.set(ip, record);

    if (record.count > limit) {
      return reply.status(429).send({ error: 'عذراً، لقد تجاوزت عدد الطلبات المسموح بها. يرجى الانتظار دقيقة واحدة.' });
    }
  };
  
  server.get('/daily', { preHandler: [rateLimiter] }, async (req, reply) => {
    const { date } = req.query as { date: string };
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0,0,0,0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23,59,59,999);

    const data = await prisma.energyLog.groupBy({
      by: ['timestamp'],
      where: {
        timestamp: { gte: targetDate, lte: endOfDay }
      },
      _avg: { powerW: true },
      orderBy: { timestamp: 'asc' }
    });
    
    // Group by hour
    const hourly: Record<string, number> = {};
    for (let i = 0; i < 24; i++) hourly[`${i.toString().padStart(2, '0')}:00`] = 0;

    data.forEach(d => {
      const h = new Date(d.timestamp).getHours().toString().padStart(2, '0') + ':00';
      hourly[h] = (d._avg.powerW || 0) / 1000; // Return in kW
    });

    const formattedData = Object.keys(hourly).map(time => ({
      time,
      power: hourly[time]
    }));

    return reply.send(formattedData);
  });

  // GET /api/energy/monthly?month=2024-01
  server.get('/monthly', { preHandler: [rateLimiter] }, async (req, reply) => {
    const { month } = req.query as { month: string };
    const targetDate = month ? new Date(`${month}-01`) : new Date();
    targetDate.setDate(1);
    targetDate.setHours(0,0,0,0);
    
    const endOfMonth = new Date(targetDate);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23,59,59,999);

    const logs = await prisma.energyLog.findMany({
      where: {
        timestamp: { gte: targetDate, lte: endOfMonth }
      }
    });

    const daily: Record<string, number> = {};
    const daysInMonth = endOfMonth.getDate();
    for (let i = 1; i <= daysInMonth; i++) daily[i.toString()] = 0;

    logs.forEach(log => {
      const d = log.timestamp.getDate().toString();
      daily[d] += log.powerW;
    });

    const data = Object.keys(daily).map(day => ({ day, power: daily[day] }));
    return reply.send(data);
  });

  // GET /api/energy/yearly?year=2024
  server.get('/yearly', { preHandler: [rateLimiter] }, async (req, reply) => {
    const { year } = req.query as { year: string };
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const logs = await prisma.energyLog.findMany({
      where: {
        timestamp: { gte: startOfYear, lte: endOfYear }
      }
    });

    const monthly: Record<string, number> = {};
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    monthNames.forEach(m => monthly[m] = 0);

    logs.forEach(log => {
      const m = monthNames[log.timestamp.getMonth()];
      monthly[m] += log.powerW;
    });

    const data = monthNames.map(month => ({ month, power: monthly[month] }));
    return reply.send(data);
  });

  // GET /api/energy/summary
  server.get('/summary', { preHandler: [rateLimiter] }, async (req, reply) => {
    try {
      const now = new Date();
      
      const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [todayLogs, monthLogs, yearLogs] = await Promise.all([
        prisma.energyLog.findMany({ where: { timestamp: { gte: startOfDay } } }),
        prisma.energyLog.findMany({ where: { timestamp: { gte: startOfMonth } } }),
        prisma.energyLog.findMany({ where: { timestamp: { gte: startOfYear } } })
      ]);

      const today = todayLogs.reduce((acc, l) => acc + l.powerW, 0);
      const thisMonth = monthLogs.reduce((acc, l) => acc + l.powerW, 0);
      const thisYear = yearLogs.reduce((acc, l) => acc + l.powerW, 0);

      // find most consuming
      const deviceUsage: Record<string, number> = {};
      monthLogs.forEach(l => {
        deviceUsage[l.deviceId] = (deviceUsage[l.deviceId] || 0) + l.powerW;
      });

      let topDeviceId = '';
      let maxUsage = 0;
      for (const [id, usage] of Object.entries(deviceUsage)) {
        if (usage > maxUsage) { maxUsage = usage; topDeviceId = id; }
      }

      let mostConsumingDevice = 'غير متوفر';
      if (topDeviceId) {
        const d = await prisma.device.findUnique({ where: { id: topDeviceId } });
        if (d) mostConsumingDevice = d.name;
      }

      // Calculate by category
      let lighting = 0;
      let appliances = 0;
      let hvac = 0;

      for (const log of monthLogs) {
        const d = await prisma.device.findUnique({ where: { id: log.deviceId } });
        if (d) {
          if (d.type === 'light') lighting += log.powerW;
          else if (d.type === 'climate') hvac += log.powerW;
          else appliances += log.powerW;
        }
      }

      return reply.send({
        today: Math.round(today / 1000), 
        thisMonth: Math.round(thisMonth / 1000),
        thisYear: Math.round(thisYear / 1000),
        peakHour: "19:00", 
        mostConsumingDevice,
        categories: {
          Lighting: Math.round(lighting / 1000),
          Appliances: Math.round(appliances / 1000),
          HVAC: Math.round(hvac / 1000)
        }
      });
    } catch (e) {
      return reply.status(500).send({ message: 'Error calculating summary' });
    }
  });

  // GET /api/energy/tariff
  server.get('/tariff', async (req, reply) => {
    try {
      let settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
      if (!settings) {
        settings = await prisma.systemSettings.create({ data: { id: 'singleton' } });
      }
      return reply.send({
        energyTariff: (settings as any).energyTariff,
        energyBudget: (settings as any).energyBudget
      });
    } catch (error) {
      return reply.status(500).send({ message: 'فشل جلب إعدادات تسعير الطاقة' });
    }
  });

  // POST /api/energy/tariff
  server.post('/tariff', async (req, reply) => {
    try {
      const data = tariffSchema.parse(req.body);
      const settings = await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: {
          energyTariff: (data as any).energyTariff,
          energyBudget: (data as any).energyBudget
        } as any,
        create: {
          id: 'singleton',
          energyTariff: (data as any).energyTariff,
          energyBudget: (data as any).energyBudget
        } as any
      });
      return reply.send({
        success: true,
        energyTariff: (settings as any).energyTariff,
        energyBudget: (settings as any).energyBudget
      });
    } catch (error: any) {
      return reply.status(400).send({ message: error.errors ? error.errors[0].message : 'بيانات غير صالحة' });
    }
  });
}
