import { FastifyInstance } from 'fastify';
import { prisma, withTimeout } from '../lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ActivityService, SecurityService } from '../services/activity.service';
import { redisClient } from '../server';
import { EmailService } from '../services/email.service';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { z } from 'zod';



const registerSchema = z.object({
  username: z.string().min(3, 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل'),
  pinCode: z.string().min(4, 'الرمز السري يجب أن يكون 4 خانات على الأقل'),
  name: z.string().min(2, 'الاسم يجب أن يكون ثنائياً على الأقل')
});

const forgotPinSchema = z.object({
  username: z.string().min(3, 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل')
});

const resetPinSchema = z.object({
  username: z.string().min(3, 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل'),
  code: z.string().length(6, 'رمز التحقق يجب أن يكون مكوناً من 6 أرقام'),
  newPinCode: z.string().min(4, 'الرمز السري الجديد يجب أن يكون 4 خانات على الأقل')
});

const loginSchema = z.object({
  username: z.string().min(3, 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل'),
  pinCode: z.string().min(4, 'الرمز السري يجب أن يكون 4 خانات على الأقل')
});

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    try {
      const { username, pinCode, name } = registerSchema.parse(request.body);
      
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return reply.status(400).send({ error: 'المستخدم موجود مسبقاً' });
      }

      const superOwnerCount = await prisma.homeMember.count({ where: { role: 'SUPER_OWNER' } });
      const needsSuperOwner = superOwnerCount === 0;

      const hashedPinCode = await bcrypt.hash(pinCode, 10);
      const user = await prisma.user.create({
        data: { username, pinCode: hashedPinCode, name, role: 'admin' } // Auto admin for setup
      });

      if (needsSuperOwner) {
        const home = await prisma.home.create({
          data: { name: 'My Smart Home', ownerId: user.id }
        });
        await prisma.homeMember.create({
          data: { homeId: home.id, userId: user.id, role: 'SUPER_OWNER' }
        });
        await prisma.tenantBranding.create({
          data: { tenantId: home.id, platformName: 'Mosa Smart Platform' }
        });
      }

      // Send Welcome Email asynchronously
      EmailService.sendWelcomeEmail(username, name);

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'بيانات التسجيل غير صالحة' });
    }
  });

  fastify.post('/forgot-pinCode', async (request, reply) => {
    try {
      const { username } = forgotPinSchema.parse(request.body);
      
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        // Return success even if user doesn't exist to prevent username enumeration
        return reply.send({ success: true, message: 'إذا كان البريد موجوداً، سيتم إرسال الرمز' });
      }

      // Generate 6 digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      // Clear old OTPs for this username
      await prisma.oTP.deleteMany({ where: { email: username, type: 'RESET_PASSWORD' } });

      await prisma.oTP.create({
        data: { email: username, code, type: 'RESET_PASSWORD', expiresAt }
      });

      await EmailService.sendOTP(user.username, code, user.name || 'User');

      return reply.send({ success: true, message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'البريد الإلكتروني غير صالح' });
    }
  });

  fastify.post('/reset-pinCode', async (request, reply) => {
    try {
      const { username, code, newPinCode } = resetPinSchema.parse(request.body);

      const otp = await prisma.oTP.findFirst({
        where: { email: username, code, type: 'RESET_PASSWORD' }
      });

      if (!otp) {
        return reply.status(400).send({ error: 'رمز التحقق غير صحيح' });
      }

      if (new Date() > otp.expiresAt) {
        return reply.status(400).send({ error: 'رمز التحقق منتهي الصلاحية' });
      }

      const hashedPinCode = await bcrypt.hash(newPinCode, 10);
      await prisma.user.update({
        where: { username },
        data: { pinCode: hashedPinCode }
      });

      // Invalidate OTP
      await prisma.oTP.delete({ where: { id: otp.id } });

      return reply.send({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'البيانات غير صالحة' });
    }
  });

  fastify.post('/login', async (request, reply) => {
    try {
      const { username, pinCode } = loginSchema.parse(request.body);
      const ip = request.ip || request.socket.remoteAddress || '127.0.0.1';
      const failKey = `auth_fail:${ip}:${username.toLowerCase()}`;

      // 🛡️ Check rate limit / lockout
      try {
        const fails = await withTimeout(redisClient.get(failKey), 100).catch(() => null);
        if (fails && parseInt(fails, 10) >= 5) {
          const ttl = await withTimeout(redisClient.ttl(failKey), 100).catch(() => 300);
          return reply.status(429).send({ 
            error: `تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول الخاطئة. يرجى الانتظار ${Math.max(1, Math.ceil(ttl / 60))} دقيقة قبل المحاولة مرة أخرى.` 
          });
        }
      } catch (redisErr) {
        // Fallback gracefully if Redis temporary blip
      }

      let superOwnerCount = 0;
      try {
        superOwnerCount = await Promise.race([
          prisma.homeMember.count({ where: { role: 'SUPER_OWNER' } }),
          new Promise<number>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 250))
        ]);
      } catch {}
      const needsSuperOwner = superOwnerCount === 0;

      let user: any = null;
      let isFallbackAdmin = false;
      try {
        user = await Promise.race([
          prisma.user.findUnique({ where: { username } }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 250))
        ]);
      } catch (dbErr) {
        user = null;
      }

      if (!user) {
        let userCount = 0;
        try {
          userCount = await withTimeout(prisma.user.count(), 200).catch(() => 0);
        } catch {}

        if (userCount === 0 && username === 'admin') {
          // SECURITY: Fallback admin ONLY on first boot (empty database)
          // Requires ADMIN_BOOTSTRAP_PIN environment variable to be set
          const bootstrapPin = process.env.ADMIN_BOOTSTRAP_PIN;
          
          if (!bootstrapPin) {
            console.error('[SECURITY] ADMIN_BOOTSTRAP_PIN not set - fallback admin disabled');
            return reply.status(401).send({ error: 'كلمة المرور غير صحيحة أو المستخدم غير موجود' });
          }
          
          isFallbackAdmin = true;
          user = {
            id: 'admin-singleton-id',
            username: 'admin',
            name: 'Administrator',
            role: 'SUPER_OWNER',
            pinCode: bcrypt.hashSync(bootstrapPin, 10),
            mfaEnabled: false,
            mustChangePin: true  // Force PIN change on first login
          };
          
          // Log security event for audit trail
          console.warn('[SECURITY] Fallback admin login used - first boot detected (userCount=0)');
          
        } else {
          try {
            await withTimeout(redisClient.incr(failKey), 100).catch(() => {});
            await withTimeout(redisClient.expire(failKey, 300), 100).catch(() => {});
          } catch {}
          return reply.status(401).send({ error: 'كلمة المرور غير صحيحة أو المستخدم غير موجود' });
        }
      }

      // If there is no Super Owner in the system, promote this user
      if (needsSuperOwner && !isFallbackAdmin) {
        try {
          let home = await prisma.home.findFirst({ where: { ownerId: user.id } });
          if (!home) {
            home = await prisma.home.create({
              data: { name: 'My Smart Home', ownerId: user.id }
            });
          }
          
          const existingMember = await prisma.homeMember.findFirst({ where: { homeId: home.id, userId: user.id } });
          if (!existingMember) {
            await prisma.homeMember.create({
              data: { homeId: home.id, userId: user.id, role: 'SUPER_OWNER' }
            });
          } else {
            await prisma.homeMember.update({
              where: { id: existingMember.id },
              data: { role: 'SUPER_OWNER' }
            });
          }

          const existingBranding = await prisma.tenantBranding.findUnique({ where: { tenantId: home.id } });
          if (!existingBranding) {
            await prisma.tenantBranding.create({
              data: { tenantId: home.id, platformName: 'Mosa Smart Platform' }
            });
          }
        } catch {}
      }

      // Verify PIN
      const isPinCodeValid = await bcrypt.compare(pinCode, user.pinCode).catch(() => false);
      if (!isPinCodeValid) {
        try {
          await withTimeout(redisClient.incr(failKey), 100).catch(() => {});
          await withTimeout(redisClient.expire(failKey, 300), 100).catch(() => {});
        } catch {}

        if (!isFallbackAdmin) {
          await ActivityService.log({
            homeId: 'system',
            userId: user.id,
            action: 'LOGIN_FAILED',
            targetType: 'USER',
            targetId: user.id,
            ipAddress: request.ip
          }).catch(() => {});
        }
        return reply.status(401).send({ error: 'كلمة المرور غير صحيحة' });
      }

      // Reset failed counter on successful authentication
      try {
        await withTimeout(redisClient.del(failKey), 100).catch(() => {});
      } catch {}

      if (user.mfaEnabled) {
         const tempToken = fastify.jwt.sign({ id: user.id, pendingMfa: true }, { expiresIn: '5m' });
         return reply.send({ requiresMfa: true, tempToken });
      }

      // Fetch user's home member status
      let homeMember: any = null;
      try {
        homeMember = await withTimeout(prisma.homeMember.findFirst({
          where: { userId: user.id },
          include: { home: true }
        }), 200).catch(() => null);
      } catch {}
      
      const role = homeMember ? homeMember.role : (isFallbackAdmin ? 'SUPER_OWNER' : 'ADMIN');
      const homeId = homeMember ? homeMember.homeId : 'home-1';
      const restrictions = homeMember ? homeMember.restrictions : null;

      // Issue short-lived access token (15 minutes) + long-lived refresh (30 days)
      const accessToken = fastify.jwt.sign({ 
        id: user.id, 
        username: user.username, 
        role: role,
        homeId: homeId,
        restrictions: restrictions,
        iat: Math.floor(Date.now() / 1000)
      }, { expiresIn: '15m' });  // SECURITY: Short-lived access token
      
      // Generate 30-day cryptographically secure refresh token
      const rawRefreshToken = crypto.randomBytes(40).toString('hex');
      const hashedRefreshToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      
      const deviceName = (request.headers['user-agent'] as string) || 'Unknown Device';
      withTimeout(prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: hashedRefreshToken,
          device: deviceName,
          ip: request.ip,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      }), 200).catch(() => null);

      const loginUserName = user.name || user.username;
      const loginMsg = `قام المستخدم (${loginUserName}) بتسجيل الدخول إلى المنصة بنجاح 🔑`;
      const targetHomeId = homeId || 'home-1';

      withTimeout(prisma.auditLog.create({
        data: {
          homeId: targetHomeId,
          userId: user.id,
          action: loginMsg,
          resource: 'جلسة الدخول',
          resourceId: user.id,
          severity: 'INFO'
        }
      }), 200).catch(() => null);

      withTimeout(prisma.notification.create({
        data: {
          homeId: targetHomeId,
          userId: user.id,
          title: 'تسجيل دخول 🔑',
          message: loginMsg,
          type: 'INFO'
        }
      }), 200).catch(() => null);

      if (fastify.io) {
        fastify.io.to(`home:${targetHomeId}`).emit('notification', {
          id: `notif_login_${Date.now()}`,
          title: 'تسجيل دخول 🔑',
          message: loginMsg,
          type: 'INFO',
          timestamp: new Date().toISOString()
        });

        fastify.io.to(`home:${targetHomeId}`).emit('activity_log', {
          id: `log_login_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: loginMsg,
          details: `تسجيل دخول ناجح عبر الحساب | IP: ${request.ip}`,
          timestamp: new Date().toISOString(),
          type: 'USER_ACTION'
        });
      }

      withTimeout(ActivityService.log({
        homeId: homeId || 'system',
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        targetType: 'USER',
        targetId: user.id,
        ipAddress: request.ip
      }), 200).catch(() => {});

      const isProd = process.env.NODE_ENV === 'production';
      const host = (request.headers.host || '').toLowerCase();
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
      const isSecure = isProd && !isLocal;

      // Set cookies
      reply.setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60  // 15 minutes (short-lived)
      });

      // NOTE: Removed duplicate 'token' cookie (was httpOnly: false, XSS risk)
      // Frontend should use the httpOnly 'access_token' cookie instead

      reply.setCookie('refresh_token', rawRefreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60  // 30 days (long-lived)
      });

      return reply.send({ 
        accessToken,
        user: { 
          id: user.id, 
          username: user.username, 
          name: user.name, 
          role: role,
          homeId: homeId,
          mustChangePin: user.mustChangePin,
          home: homeMember?.home ? {
             id: homeMember.home.id,
             name: homeMember.home.name,
             energyBudgetKwh: (homeMember?.home as any)?.energyBudgetKwh ?? 50
          } : null
        } 
      });
    } catch (dbError: any) {
      if (dbError.issues || dbError.errors) {
        return reply.status(400).send({ error: dbError.message || 'بيانات تسجيل الدخول غير صالحة' });
      }
      fastify.log.error(dbError, 'Database offline during login');
      return reply.status(500).send({ error: 'خدمة قاعدة البيانات غير متاحة حالياً' });
    }
  });

  // POST /api/auth/qr-login - Direct QR Code Authentication
  fastify.post('/qr-login', async (request, reply) => {
    try {
      const { token } = request.body as { token: string };
      if (!token) return reply.status(400).send({ error: 'رمز الدخول (QR Token) مطلوب' });

      const invite = await prisma.inviteToken.findUnique({
        where: { tokenHash: token },
        include: { home: true }
      });

      if (!invite) {
        return reply.status(401).send({ error: 'باركود الدخول غير صالح أو تم إلغاؤه' });
      }

      if (new Date() > invite.expiresAt) {
        return reply.status(401).send({ error: 'عذراً، انتهت صلاحية باركود الدخول هذا' });
      }

      // Resolve specific user account if this token was generated for an existing user
      let user = null;
      if (invite.tokenHash.startsWith('mosa_qr_user_')) {
        const parts = invite.tokenHash.split('_');
        const targetUserId = parts[3];
        if (targetUserId) {
          user = await prisma.user.findUnique({ where: { id: targetUserId } });
        }
      }

      if (!user) {
        // Find existing guest user or create ephemeral user for this invite
        const guestUsername = `guest_${invite.id.substring(0, 8)}`;
        user = await prisma.user.findUnique({ where: { username: guestUsername } });
        if (!user) {
          const hashedPin = await bcrypt.hash('0000', 10);
          user = await prisma.user.create({
            data: {
              username: guestUsername,
              pinCode: hashedPin,
              name: 'ضيف المنزل (QR)',
              role: invite.role.toLowerCase()
            }
          });
        }
      }

      // Ensure membership
      let member = await prisma.homeMember.findFirst({
        where: { homeId: invite.homeId, userId: user.id }
      });

      if (!member) {
        member = await prisma.homeMember.create({
          data: {
            homeId: invite.homeId,
            userId: user.id,
            role: invite.role as any,
            expiresAt: invite.expiresAt
          }
        });
      }

      const role = member.role;
      const homeId = invite.homeId;
      const homeName = invite.home.name;

      const accessToken = fastify.jwt.sign({
        id: user.id,
        username: user.username,
        role: role,
        homeId: homeId,
        iat: Math.floor(Date.now() / 1000)
      }, { expiresIn: '15m' });

      const rawRefreshToken = crypto.randomBytes(40).toString('hex');
      const hashedRefreshToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: hashedRefreshToken,
          device: (request.headers['user-agent'] as string) || 'QR Scanner Mobile',
          ip: request.ip,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      const isProd = process.env.NODE_ENV === 'production';

      reply.setCookie('refreshToken', rawRefreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60
      });

      reply.setCookie('refresh_token', rawRefreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60
      });

      reply.setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60
      });

      const loginMsg = `تم تسجيل دخول جديد عبر باركود المنزل الذكي (QR Code) بنجاح 📲`;
      fastify.io.to(`home:${homeId}`).emit('activity_log', {
        id: `log_qr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        message: loginMsg,
        details: `تسجيل دخول فوري عبر مسح الباركود | الدور: ${role}`,
        timestamp: new Date().toISOString(),
        type: 'USER_ACTION'
      });

      return reply.send({
        success: true,
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role,
          homeId,
          homeName
        }
      });
    } catch (err: any) {
      console.error('[API] /qr-login error:', err);
      return reply.status(500).send({ error: 'حدث خطأ أثناء تسجيل الدخول عبر الباركود' });
    }
  });

  // POST /api/auth/refresh - Secure Refresh Token Rotation
  fastify.post('/refresh', async (request, reply) => {
    const rawToken = request.cookies?.refreshToken || request.cookies?.refresh_token;
    if (!rawToken) {
      return reply.status(401).send({ error: 'انتهت الجلسة، يرجى تسجيل الدخول' });
    }

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 1. Search session by hashed token OR plain token (migration fallback)
    const session = await prisma.session.findFirst({
      where: {
        OR: [
          { refreshToken: hashedToken },
          { refreshToken: rawToken }
        ]
      },
      include: { user: true }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (session && !session.revokedAt) {
        // Reuse detection: Invalidate session immediately
        await prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() }
        }).catch(() => {});
      }
      reply.clearCookie('access_token', { path: '/' });
      reply.clearCookie('token', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/' });
      reply.clearCookie('refresh_token', { path: '/' });
      return reply.status(401).send({ error: 'جلسة غير صالحة أو منتهية' });
    }

    // 2. Single-use rotation: Revoke used session
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    }).catch(() => {});

    const targetUser = session.user;
    const homeMember = await prisma.homeMember.findFirst({
      where: { userId: targetUser.id }
    });
    const role = homeMember ? homeMember.role : (targetUser.role || 'GUEST');
    const homeId = homeMember ? homeMember.homeId : null;
    const restrictions = homeMember ? homeMember.restrictions : null;

    // 3. Issue new refresh token & session
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHashedRefreshToken = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

    await prisma.session.create({
      data: {
        userId: targetUser.id,
        refreshToken: newHashedRefreshToken,
        device: (request.headers['user-agent'] as string) || 'Device',
        ip: request.ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    const isProd = process.env.NODE_ENV === 'production';

    const accessToken = fastify.jwt.sign({ 
      id: targetUser.id, 
      username: targetUser.username, 
      role: role,
      homeId: homeId,
      restrictions: restrictions,
      iat: Math.floor(Date.now() / 1000)
    }, { expiresIn: '15m' });
    
    const host = (request.headers.host || '').toLowerCase();
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
    const isSecure = isProd && !isLocal;

    reply.setCookie('access_token', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    });

    // NOTE: Removed duplicate 'token' cookie (XSS risk)

    reply.setCookie('refreshToken', newRawRefreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    });

    reply.setCookie('refresh_token', newRawRefreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    });

    return reply.send({ 
      success: true, 
      accessToken,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        role,
        homeId
      }
    });
  });

  fastify.post('/logout', async (request, reply) => {
    const rawRefreshToken = request.cookies.refreshToken || request.cookies.refresh_token;
    if (rawRefreshToken) {
      const hashed = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await prisma.session.deleteMany({
        where: {
          OR: [
            { refreshToken: hashed },
            { refreshToken: rawRefreshToken }
          ]
        }
      }).catch(() => {});
    }

    const accessToken = request.cookies.access_token || (request.headers.authorization && request.headers.authorization.startsWith('Bearer ') ? request.headers.authorization.substring(7) : null);
    if (accessToken) {
       try {
         await redisClient.setex(`bl_${accessToken}`, 15 * 60, 'revoked');
       } catch (e) {
         fastify.log.warn('Redis offline, could not blacklist token');
       }
    }

    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('token', { path: '/' });  // Legacy cleanup
    reply.clearCookie('refreshToken', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });

    return reply.send({ success: true });
  });

  fastify.post('/switch-home', {
    onRequest: [async (request, reply) => {
      try { await request.jwtVerify(); } catch (err) { reply.send(err); }
    }]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { homeId } = request.body as { homeId: string };
      
      const homeMember = await prisma.homeMember.findFirst({
        where: { userId: user.id, homeId }
      });
      
      if (!homeMember) {
        return reply.status(403).send({ error: 'Access denied to this home' });
      }

      const accessToken = fastify.jwt.sign({ 
        id: user.id, 
        username: user.username, 
        role: homeMember.role,
        homeId: homeId,
        restrictions: homeMember.restrictions
      }, { expiresIn: '15m' });

      reply.setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/'
      });

      return reply.send({ success: true, accessToken });
    } catch (e) {
      return reply.status(500).send({ error: 'Failed to switch home' });
    }
  });

  fastify.get('/me', {
    onRequest: [async (request, reply) => {
      try { await request.jwtVerify(); } catch (err) { reply.send(err); }
    }]
  }, async (request, reply) => {
    const jwtUser: any = request.user;
    if (!jwtUser || !jwtUser.id) return reply.status(401).send({ error: 'Unauthorized' });

    const dbUser = await prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: { id: true, username: true, name: true, role: true }
    });

    const homeMember = await prisma.homeMember.findFirst({
      where: { userId: jwtUser.id }
    });

    const homeId = homeMember?.homeId || jwtUser.homeId || 'home-1';
    const restrictions = homeMember ? homeMember.restrictions : null;

    return {
      ...dbUser,
      homeId,
      role: dbUser?.role || homeMember?.role || jwtUser.role || 'RESTRICTED',
      restrictions
    };
  });

  const requireAuth = async (request: any, reply: any) => {
    try { await request.jwtVerify(); } catch (err) { reply.send(err); }
  };

  fastify.get('/sessions', { onRequest: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    const sessions = await prisma.session.findMany({ 
       where: { userId: user.id },
       orderBy: { createdAt: 'desc' } 
    });
    return reply.send(sessions);
  });

  fastify.delete('/sessions/:id', { onRequest: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    // Ensure the session belongs to the user
    await prisma.session.delete({ where: { id, userId: user.id } });
    return reply.send({ success: true });
  });

  fastify.delete('/sessions', { onRequest: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user;
    // Revoke all except current session
    await prisma.session.updateMany({ 
       where: { userId: user.id },
       data: { revokedAt: new Date() } 
    });
    return reply.send({ success: true });
  });

  // ==========================
  // MFA Routes (Phase 1.3)
  // ==========================
  
  fastify.post('/mfa/setup', { onRequest: [requireAuth] }, async (request, reply) => {
     const user = (request as any).user;
     
     const secret = speakeasy.generateSecret({
       name: `Mosa Platform (${user.username})`
     });
     
     await prisma.user.update({
       where: { id: user.id },
       data: { mfaSecret: secret.base32 }
     });

     const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
     
     return reply.send({ secret: secret.base32, qrCodeUrl });
  });

  fastify.post('/mfa/verify', { onRequest: [requireAuth] }, async (request, reply) => {
     const user = (request as any).user;
     const { token } = request.body as any;

     const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
     if (!dbUser || !dbUser.mfaSecret) {
       return reply.status(400).send({ error: 'إعداد التحقق الثنائي لم يبدأ' });
     }

     const verified = speakeasy.totp.verify({
       secret: dbUser.mfaSecret,
       encoding: 'base32',
       token: token,
       window: 1
     });

     if (!verified) {
       return reply.status(400).send({ error: 'الرمز غير صحيح' });
     }

     await prisma.user.update({
       where: { id: user.id },
       data: { mfaEnabled: true }
     });

     return reply.send({ success: true, message: "تم تفعيل التحقق الثنائي بنجاح" });
  });

  fastify.post('/login/mfa', async (request, reply) => {
    const { tempToken, mfaCode } = request.body as any;
    try {
      const decoded: any = fastify.jwt.verify(tempToken);
      if (!decoded.pendingMfa || !decoded.id) {
         return reply.status(401).send({ error: 'رمز مؤقت غير صالح' });
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || !user.mfaSecret || !user.mfaEnabled) {
         return reply.status(401).send({ error: 'حالة المستخدم غير صالحة' });
      }

      const verified = speakeasy.totp.verify({
         secret: user.mfaSecret,
         encoding: 'base32',
         token: mfaCode,
         window: 1
      });

      if (!verified) {
         return reply.status(401).send({ error: 'الرمز غير صحيح' });
      }

      const homeMember = await prisma.homeMember.findFirst({
        where: { userId: user.id }
      });
      
      const role = homeMember ? homeMember.role : 'GUEST';
      const homeId = homeMember ? homeMember.homeId : null;
      const restrictions = homeMember ? homeMember.restrictions : null;

      const accessToken = fastify.jwt.sign({ 
        id: user.id, 
        username: user.username, 
        role: role,
        homeId: homeId,
        restrictions: restrictions
      }, { expiresIn: '15m' });
      
      const refreshToken = crypto.randomBytes(40).toString('hex');
      
      const deviceName = request.headers['user-agent'] || 'Unknown Device';
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken,
          device: deviceName,
          ip: request.ip,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/api/auth/refresh'
      });

      reply.setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 15 * 60,
        path: '/'
      });

      return reply.send({ 
        accessToken, 
        user: { 
          id: user.id, 
          username: user.username, 
          name: user.name, 
          role: role,
          homeId: homeId,
          mustChangePin: user.mustChangePin
        } 
      });
    } catch (err) {
      return reply.status(401).send({ error: 'انتهت صلاحية الجلسة' });
    }
  });
}
