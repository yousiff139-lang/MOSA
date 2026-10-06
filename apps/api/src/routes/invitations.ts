import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import crypto from 'crypto';

export const createInviteSchema = z.object({
  role: z.nativeEnum(Role),
  expiresInHours: z.number().min(1).max(720).default(24) // up to 30 days
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10)
});

export async function invitationRoutes(server: FastifyInstance) {
  
  // 1. Create an Invitation (Admin/Owner only)
  server.post('/', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = createInviteSchema.parse(req.body);
      const homeId = req.tenant.homeId;

      // Generate a secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

      await prisma.inviteToken.create({
        data: {
          homeId,
          role: data.role,
          tokenHash,
          expiresAt
        }
      });

      // Log the action
      await prisma.auditLog.create({
         data: {
            homeId,
            userId: req.tenant.userId,
            action: 'CREATE_INVITATION',
            resource: data.role,
            ipAddress: req.ip
         }
      });

      // The rawToken is returned ONLY once. The DB only stores the hash.
      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite?token=${rawToken}`;
      
      // If the user requested email delivery, we could trigger a mailer here.
      // e.g. await sendEmail({ to: data.email, link: inviteLink });
      
      return reply.status(201).send({ link: inviteLink, token: rawToken, expiresAt });
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  // 2. Validate Invitation Token (Public/Auth-optional)
  server.get('/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invite = await prisma.inviteToken.findUnique({
      where: { tokenHash },
      include: { home: { select: { name: true } } }
    });

    if (!invite) return reply.status(404).send({ message: 'رابط الدعوة غير صحيح' });
    if (invite.usedAt) return reply.status(400).send({ message: 'رابط الدعوة مستخدم مسبقاً' });
    if (new Date() > invite.expiresAt) return reply.status(400).send({ message: 'رابط الدعوة منتهي الصلاحية' });

    return reply.send({
      homeName: invite.home.name,
      role: invite.role,
      expiresAt: invite.expiresAt
    });
  });

  // 3. Accept Invitation (Requires Logged-In User)
  server.post('/accept', async (req, reply) => {
    try {
      let jwtToken = '';
      if (req.cookies && req.cookies.access_token) {
        jwtToken = req.cookies.access_token;
      } else {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          jwtToken = authHeader.split(' ')[1];
        }
      }

      if (!jwtToken) return reply.status(401).send({ error: 'Missing Auth' });
      const decoded = server.jwt.verify(jwtToken) as any;
      const userId = decoded.sub;

      const { token } = acceptInviteSchema.parse(req.body);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const invite = await prisma.inviteToken.findUnique({ where: { tokenHash } });

      if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
        return reply.status(400).send({ message: 'رابط الدعوة غير صالح أو منتهي' });
      }

      // Add user to Home
      await prisma.homeMember.upsert({
        where: {
          homeId_userId: { homeId: invite.homeId, userId }
        },
        update: {
          role: invite.role // Upgrade role if already a member? Or throw error. Let's upgrade.
        },
        create: {
          homeId: invite.homeId,
          userId,
          role: invite.role
        }
      });

      // Mark token as used
      await prisma.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() }
      });

      return reply.send({ success: true, homeId: invite.homeId });
    } catch (error) {
      return reply.status(400).send({ message: 'فشل قبول الدعوة' });
    }
  });
}
