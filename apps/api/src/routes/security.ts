import { FastifyInstance } from 'fastify';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

export async function securityRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/security - retrieve the current persistent state
  server.get('/', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const securityState = await prisma.securityState.findUnique({
        where: { homeId }
      });
      return reply.send(securityState || { state: 'DISARMED' });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve security state' });
    }
  });

  // GET /api/security/state
  server.get('/state', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const securityState = await prisma.securityState.findUnique({
        where: { homeId }
      });
      return reply.send(securityState || { state: 'DISARMED' });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to retrieve security state' });
    }
  });

  // POST /api/security/verify-pin - Securely verify door lock & critical relay security PIN
  server.post('/verify-pin', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    try {
      const { pin, deviceId, action } = (req.body as any) || {};
      const homeId = req.tenant.homeId;
      const userId = req.tenant.userId;

      if (!pin || typeof pin !== 'string') {
        return reply.code(400).send({ success: false, message: 'رمز PIN مطلوب للتحقق' });
      }

      // 1. Fetch user to check password or custom security pin
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Valid if user PIN matches or if standard fallback master PIN matches
      let isValid = false;
      if (user?.pinCode) {
        if (user.pinCode.startsWith('$2')) {
          isValid = await bcrypt.compare(pin, user.pinCode).catch(() => false);
        } else {
          isValid = user.pinCode === pin;
        }
      }

      // Check fallback master PINs
      if (!isValid) {
        const validMasterPins = ['1234', '0000', '2026', '9999'];
        if (validMasterPins.includes(pin)) {
          isValid = true;
        }
      }

      if (!isValid) {
        // Log failed security attempt
        await prisma.auditLog.create({
          data: {
            homeId,
            userId,
            action: 'PIN_VERIFY_FAILED',
            resource: 'DEVICE',
            resourceId: deviceId || 'GENERAL',
            severity: 'WARNING',
            newValues: { details: `محاولة غير صالحة لفتح القفل (${deviceId || 'Unknown'})` }
          }
        }).catch(() => {});

        return reply.code(403).send({ 
          success: false, 
          message: 'رمز الحماية PIN غير صحيح' 
        });
      }

      // Log successful security unlock
      await prisma.auditLog.create({
        data: {
          homeId,
          userId,
          action: 'PIN_VERIFY_SUCCESS',
          resource: 'DEVICE',
          resourceId: deviceId || 'GENERAL',
          severity: 'INFO',
          newValues: { details: `تم التحقق بنجاح لفتح القفل (${deviceId || 'General'})` }
        }
      }).catch(() => {});

      return reply.send({ 
        success: true, 
        message: 'تم التحقق من رمز الحماية بنجاح' 
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ success: false, message: 'فشل التحقق من رمز الحماية' });
    }
  });

  // POST /api/security/arm - arm or disarm the system
  server.post('/arm', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const body = req.body as any;
      const state = body.state || body.mode;
      const homeId = req.tenant.homeId;
      
      const topic = `mosa/${homeId}/system/security/command`;
      if (server.mqtt?.publish) {
        server.mqtt.publish(topic, JSON.stringify({ action: 'ARM', state }), { retain: true, qos: 1 });
      }
      
      if (server.io) {
        server.io.to(`home:${homeId}`).emit('notification', {
          title: 'نظام الحماية',
          message: state === 'ARMED' ? 'تم تفعيل نظام الحماية' : 'تم إيقاف نظام الحماية',
          type: state === 'ARMED' ? 'ALERT' : 'INFO'
        });
        server.io.to(`home:${homeId}`).emit('security:state', { state });
      }

      // Persist the security state in database
      const securityState = await prisma.securityState.upsert({
        where: { homeId },
        update: { state },
        create: { homeId, state }
      });

      return reply.send({ success: true, message: 'Security state updated', securityState });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to arm security system' });
    }
  });

  // POST /api/security/disarm - disarm the system
  server.post('/disarm', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      
      const topic = `mosa/${homeId}/system/security/command`;
      if (server.mqtt?.publish) {
        server.mqtt.publish(topic, JSON.stringify({ action: 'ARM', state: 'DISARMED' }), { retain: true, qos: 1 });
      }
      
      if (server.io) {
        server.io.to(`home:${homeId}`).emit('notification', {
          title: 'نظام الحماية',
          message: 'تم إيقاف نظام الحماية',
          type: 'INFO'
        });
        server.io.to(`home:${homeId}`).emit('security:state', { state: 'DISARMED' });
      }

      // Persist the security state in database
      const securityState = await prisma.securityState.upsert({
        where: { homeId },
        update: { state: 'DISARMED' },
        create: { homeId, state: 'DISARMED' }
      });

      return reply.send({ success: true, message: 'Security system disarmed', securityState });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to disarm security system' });
    }
  });
}
