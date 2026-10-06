import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;           // userId
  activeHomeId: string;  // The home they are currently operating in
  membershipId: string;  // The ID of their HomeMember record
  role: Role;            // Their role in the active home
  isSuperAdmin: boolean; // Platform-wide override flag
  exp?: number;
  iat?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: {
      userId: string;
      homeId: string;
      membershipId: string;
      role: Role;
      isSuperAdmin: boolean;
    }
  }
}
