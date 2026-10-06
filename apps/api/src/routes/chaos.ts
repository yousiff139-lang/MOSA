import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';
import { requireRole, Role } from '../lib/permissions';

export async function chaosRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // POST /api/chaos/toggle
  // SECURITY FIX #18: Require ADMIN role + disable in production
  server.post('/toggle', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    // SECURITY: Disable chaos testing in production
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_CHAOS !== 'true') {
      return reply.status(403).send({ 
        message: 'Chaos testing is disabled in production for safety' 
      });
    }

    try {
      const { enable } = req.body as { enable: boolean };
      
      const { ChaosService } = await import('../services/chaos.service');
      // For simplicity in this demo, we can just instantiate a new one or ideally 
      // we would have a singleton instance from server.ts
      
      // Let's use a global trick for the MVP
      if (!(global as any).chaosEngine) {
         (global as any).chaosEngine = new ChaosService(server);
      }
      const chaos = (global as any).chaosEngine as any;

      if (enable) {
        chaos.enableChaosMode();
      } else {
        chaos.disableChaosMode();
      }

      return reply.send({ success: true, enabled: chaos.isChaosEnabled() });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'فشل تغيير حالة الفوضى' });
    }
  });
}
