import { FastifyInstance } from 'fastify';
import { ZigbeeService } from '../services/zigbee.service';
import { verifyTenant, requireRole, Role } from '../lib/permissions';

export default async function zigbeeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyTenant);
  
  fastify.post('/permit_join', { preHandler: [requireRole(Role.ADMIN)] }, async (request, reply) => {
    try {
      const { permit } = request.body as { permit: boolean };
      
      await ZigbeeService.setPermitJoin(permit, fastify.mqtt);

      return reply.send({
        success: true,
        message: permit ? 'تم فتح شبكة Zigbee للاقتران لمدة دقيقتين' : 'تم إغلاق شبكة Zigbee'
      });
      
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'فشل الاتصال بمحرك Zigbee2MQTT' });
    }
  });

}

