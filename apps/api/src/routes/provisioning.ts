import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProvisioningService } from '../services/provisioningService';
import { Role, requireRole } from '../lib/permissions';
import fs from 'fs';
import path from 'path';

export async function provisioningRoutes(server: FastifyInstance) {
  
  // 1. Generate One-Time Enrollment Secret (OTES) - Restricted to Owner/Admin
  server.post('/token', {
    preHandler: [requireRole(Role.ADMIN)]
  }, async (req, reply) => {
    try {
      const schema = z.object({
        mac: z.string().min(12).max(17),
        deviceName: z.string().optional(),
        homeId: z.string().optional()
      });

      const body = schema.parse(req.body);
      const user = (req as any).user;

      const result = ProvisioningService.generateOTESToken({
        mac: body.mac,
        deviceName: body.deviceName,
        homeId: body.homeId,
        createdBy: user?.id || 'admin'
      });

      return reply.send({
        success: true,
        data: result
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err.message
      });
    }
  });

  // 2. Submit Device CSR + OTES Token to receive signed mTLS client certificate
  server.post('/sign-csr', async (req, reply) => {
    try {
      const schema = z.object({
        token: z.string().min(8),
        mac: z.string().min(12).max(17),
        csr: z.string().min(50)
      });

      const body = schema.parse(req.body);
      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const result = await ProvisioningService.signDeviceCSR({
        token: body.token,
        mac: body.mac,
        csr: body.csr,
        clientIp
      });

      return reply.send({
        success: true,
        data: result
      });
    } catch (err: any) {
      const isAuthError = err.message.includes('token') || err.message.includes('expired') || err.message.includes('Rate limit');
      return reply.status(isAuthError ? 401 : 400).send({
        success: false,
        error: err.message
      });
    }
  });

  // 3. Download CA Chain bundle for device initial trust
  server.get('/ca-chain', async (req, reply) => {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'config/pki/ca_chain.crt'),
        path.resolve(process.cwd(), 'config/certs/ca_chain.crt'),
        path.resolve('/app/config/pki/ca_chain.crt')
      ];
      let caChainContent = '';
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          caChainContent = fs.readFileSync(c, 'utf8');
          break;
        }
      }

      if (!caChainContent) {
        return reply.status(404).send({ error: 'CA chain not found.' });
      }

      reply.header('Content-Type', 'application/x-pem-file');
      return reply.send(caChainContent);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
