import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma, withTimeout } from './prisma';

import { JwtPayload } from '../types/auth';

export enum Role {
  SUPER_OWNER = 'SUPER_OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  RESTRICTED = 'RESTRICTED',
  GUEST = 'GUEST'
}



// Map roles to hierarchy level
const roleLevel = {
  [Role.SUPER_OWNER]: 5,
  [Role.ADMIN]: 4,
  [Role.MEMBER]: 3,
  [Role.RESTRICTED]: 2,
  [Role.GUEST]: 1
};

export async function verifyTenant(req: FastifyRequest, reply: FastifyReply) {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return reply.status(401).send({ error: 'Missing Auth' });
    }

    let decoded: any;
    try {
      decoded = req.server.jwt.verify<JwtPayload>(token);
    } catch (err: any) {
      if (err?.code === 'FAST_JWT_EXPIRED' || err?.message?.includes('expired')) {
        return reply.status(401).send({ error: 'Token has expired', code: 'TOKEN_EXPIRED' });
      }
      return reply.status(401).send({ error: 'Invalid Token' });
    }

    if (!decoded) {
      return reply.status(401).send({ error: 'Unauthorized Tenant Access' });
    }

    let homeId = decoded.activeHomeId || (decoded as any).homeId;
    const userId = decoded.sub || (decoded as any).id;

    if (!homeId || homeId === 'home-1') {
      try {
        const userHomeMember = await withTimeout(prisma.homeMember.findFirst({
          where: { userId },
          include: { home: true }
        }), 200).catch(() => null);
        if (userHomeMember) {
          homeId = userHomeMember.homeId;
        } else {
          const firstHome = await withTimeout(prisma.home.findFirst(), 200).catch(() => null);
          if (firstHome) homeId = firstHome.id;
        }
      } catch (e) {
        homeId = homeId || 'home_default';
      }
    }

    const userObj = await withTimeout(prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, role: true }
    }), 200).catch(() => null);

    // Fetch active HomeMember to get live role and membership
    const homeMember = (homeId && userId) ? await withTimeout(prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId } },
      include: {
        roomPermissions: { include: { room: true } },
        devicePermissions: { include: { device: true } }
      }
    }), 200).catch(() => null) : null;

    const resolvedRole = (homeMember?.role || userObj?.role || decoded.role || Role.SUPER_OWNER) as Role;
    const resolvedName = userObj?.name || userObj?.username || (decoded as any).name || (decoded as any).username || 'Admin';

    req.tenant = {
      userId,
      homeId: homeId || 'home-1',
      role: resolvedRole,
      membershipId: homeMember?.id || 'unknown',
      isSuperAdmin: resolvedRole === Role.ADMIN || resolvedRole === Role.SUPER_OWNER,
      name: resolvedName,
      username: resolvedName
    } as any;

    // If GUEST or RESTRICTED, fetch allowed Rooms and Devices
    const isRestrictedRole = resolvedRole === Role.GUEST || resolvedRole === Role.RESTRICTED || (resolvedRole as string) === 'RESTRICTED_USER';
    if (isRestrictedRole) {
       const userRoomAccess = await withTimeout(prisma.roomAccess.findMany({
          where: { userId: req.tenant.userId },
          include: { room: true }
       }), 200).catch(() => []);

       const roomAccessIds: string[] = (userRoomAccess || []).map(ra => ra.roomId);
       const roomAccessNames: string[] = (userRoomAccess || []).map(ra => ra.room?.name || '').filter(Boolean);
       const roomPermIds: string[] = (homeMember?.roomPermissions || []).map(rp => rp.roomId);
       const roomPermNames: string[] = (homeMember?.roomPermissions || []).map(rp => rp.room?.name || '').filter(Boolean);
       const allAllowedRooms = Array.from(new Set([...roomAccessIds, ...roomPermIds, ...roomAccessNames, ...roomPermNames]));

       const restrictionsObj = (homeMember?.restrictions as any) || {};
       const allowedNodeIds: string[] = restrictionsObj.allowedNodeIds || [];
       const directDeviceIds: string[] = (homeMember?.devicePermissions || []).map(dp => dp.deviceId);
       
       (req.tenant as any).allowedRoomIds = allAllowedRooms;
       (req.tenant as any).allowedDeviceIds = Array.from(new Set([
          ...directDeviceIds,
          ...allowedNodeIds
       ]));
       (req.tenant as any).restrictions = restrictionsObj;
    }

  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized Tenant Access' });
  }
}

export function requireRole(minimumRole: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenant) {
      await verifyTenant(req, reply);
      if (reply.sent) return;
    }
    if (!req.tenant) {
      return reply.status(401).send({ error: 'Unauthorized Tenant Access' });
    }
    if (req.tenant.isSuperAdmin) return;
    
    if (roleLevel[req.tenant.role] < roleLevel[minimumRole]) {
      return reply.status(403).send({ error: 'Insufficient Permissions' });
    }
  };
}

export async function buildCheckPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  requiredRole: Role,
  options?: { checkTime?: boolean; checkDevice?: string }
) {
  try {
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { homeId } = request.params as any;
    if (!homeId) {
      return reply.status(400).send({ error: 'homeId is required' });
    }

    const homeMember = await prisma.homeMember.findUnique({
      where: {
        homeId_userId: {
          homeId,
          userId: user.sub || user.id
        }
      }
    });

    if (!homeMember) {
      return reply.status(403).send({ error: 'Forbidden: Not a member of this home' });
    }

    // 1. Check Role Hierarchy
    if (roleLevel[homeMember.role] < roleLevel[requiredRole]) {
      // Log failed attempt
      await prisma.activityLog.create({
        data: {
          userId: user.sub || user.id, 
          homeId: (request as any).params?.homeId || 'system', 
          action: 'ACCESS_DENIED',
          targetType: 'SYSTEM',
          targetId: 'system',
          metadata: { reason: 'Insufficient role', required: requiredRole, actual: homeMember.role },
          ipAddress: request.ip
        }
      });
      return reply.status(403).send({ error: `Forbidden: Requires ${requiredRole} role` });
    }

    // 2. Check Expiry for GUEST
    if (homeMember.role === Role.GUEST && homeMember.expiresAt) {
      if (new Date() > new Date(homeMember.expiresAt)) {
        return reply.status(403).send({ error: 'Forbidden: Guest access has expired' });
      }
    }

    // 3. Check Time Restrictions for RESTRICTED
    if (options?.checkTime && homeMember.role === Role.RESTRICTED) {
      const restrictions: any = homeMember.restrictions || {};
      if (restrictions.allowedHours) {
        const [startHour, endHour] = restrictions.allowedHours;
        const currentHour = new Date().getHours();
        if (currentHour < startHour || currentHour >= endHour) {
          return reply.status(403).send({ error: 'Forbidden: Access outside allowed hours' });
        }
      }
    }

    // 4. Check Device Whitelist
    if (options?.checkDevice && homeMember.role === Role.RESTRICTED) {
      const restrictions: any = homeMember.restrictions || {};
      if (restrictions.deviceWhitelist && Array.isArray(restrictions.deviceWhitelist)) {
        if (!restrictions.deviceWhitelist.includes(options.checkDevice)) {
          return reply.status(403).send({ error: 'Forbidden: Device not in whitelist' });
        }
      }
      if (restrictions.viewOnly) {
        // If it's a mutation (POST, PUT, DELETE, PATCH), block it
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
          return reply.status(403).send({ error: 'Forbidden: View-only access' });
        }
      }
    }

    // Attach member details to request context for downstream use
    (request as any).homeMember = homeMember;

  } catch (error) {
    console.error('Permission check error:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export function logActivity(homeId: string, userId: string, action: string, details: any, ipAddress: string) {
  return prisma.activityLog.create({
    data: { homeId, userId, action, targetType: 'SYSTEM', targetId: 'system', metadata: details, ipAddress }
  });
}
