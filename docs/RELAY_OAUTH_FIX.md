# 🚨 CRITICAL: Cloud Relay OAuth Security Issue

**Status:** 🔴 REQUIRES IMMEDIATE FIX  
**Risk:** Complete voice assistant security bypass

---

## Problem

The cloud relay OAuth implementation uses **mock tokens** that provide zero authentication:

```typescript
// Line 118-119 in apps/relay/server.ts
const authCode = 'mock_auth_code_' + uuidv4();

// Line 128-129
access_token: 'mock_access_token_' + uuidv4(),
```

**Impact:**
- Anyone can generate their own "mock" tokens
- No user authentication required
- Voice assistants (Google Home, Alexa) have unrestricted access
- Any homeId can be controlled by anyone

---

## Required Fix (2-3 hours)

### Step 1: Database Schema (30 minutes)

Add to `prisma/schema.prisma`:

```prisma
model OAuthAuthorizationCode {
  id        String   @id @default(cuid())
  code      String   @unique
  userId    String
  homeId    String
  clientId  String
  redirectUri String
  scope     String?
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
  home      Home     @relation(fields: [homeId], references: [id])
  
  @@index([code])
  @@index([userId])
  @@index([homeId])
}

model OAuthAccessToken {
  id           String   @id @default(cuid())
  accessToken  String   @unique
  refreshToken String?  @unique
  userId       String
  homeId       String
  clientId     String
  scope        String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  
  user         User     @relation(fields: [userId], references: [id])
  home         Home     @relation(fields: [homeId], references: [id])
  
  @@index([accessToken])
  @@index([refreshToken])
  @@index([userId])
  @@index([homeId])
}
```

Run migration:
```bash
cd apps/api
npx prisma migrate dev --name add-oauth-tokens
```

---

### Step 2: OAuth Service (1 hour)

Create `apps/relay/services/oauth.service.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export class OAuthService {
  /**
   * Generate authorization code
   */
  static async generateAuthorizationCode(
    userId: string,
    homeId: string,
    clientId: string,
    redirectUri: string,
    scope?: string
  ): Promise<string> {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        userId,
        homeId,
        clientId,
        redirectUri,
        scope,
        expiresAt,
      },
    });
    
    return code;
  }
  
  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(
    code: string,
    clientId: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
    // Find and validate authorization code
    const authCode = await prisma.oAuthAuthorizationCode.findUnique({
      where: { code },
      include: { user: true, home: true },
    });
    
    if (!authCode) return null;
    if (authCode.used) return null;
    if (authCode.expiresAt < new Date()) return null;
    if (authCode.clientId !== clientId) return null;
    if (authCode.redirectUri !== redirectUri) return null;
    
    // Mark code as used
    await prisma.oAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { used: true },
    });
    
    // Generate access token (JWT)
    const accessToken = jwt.sign(
      { userId: authCode.userId, homeId: authCode.homeId, scope: authCode.scope },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Store access token
    await prisma.oAuthAccessToken.create({
      data: {
        accessToken,
        refreshToken,
        userId: authCode.userId,
        homeId: authCode.homeId,
        clientId,
        scope: authCode.scope,
        expiresAt,
      },
    });
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }
  
  /**
   * Verify access token
   */
  static async verifyAccessToken(token: string): Promise<{
    userId: string;
    homeId: string;
    scope?: string;
  } | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if token exists in database and not expired
      const storedToken = await prisma.oAuthAccessToken.findUnique({
        where: { accessToken: token },
      });
      
      if (!storedToken || storedToken.expiresAt < new Date()) {
        return null;
      }
      
      return {
        userId: decoded.userId,
        homeId: decoded.homeId,
        scope: decoded.scope,
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  } | null> {
    const storedToken = await prisma.oAuthAccessToken.findUnique({
      where: { refreshToken },
    });
    
    if (!storedToken) return null;
    
    // Generate new access token
    const accessToken = jwt.sign(
      { userId: storedToken.userId, homeId: storedToken.homeId, scope: storedToken.scope },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Update stored token
    await prisma.oAuthAccessToken.update({
      where: { id: storedToken.id },
      data: { accessToken, expiresAt },
    });
    
    return {
      accessToken,
      expiresIn: 3600,
    };
  }
}
```

---

### Step 3: Update Relay Endpoints (30 minutes)

Replace mock implementation in `apps/relay/server.ts`:

```typescript
import { OAuthService } from './services/oauth.service';

// 1. OAuth2 Authorization Endpoint
server.get('/oauth/authorize', async (request, reply) => {
  const query = request.query as any;
  
  // TODO: Render login page to authenticate user
  // For now, assume user is authenticated and we have userId
  const userId = query.user_id || 'mock-user-id'; // FIXME: Get from session
  const homeId = query.home_id || 'HOME_123'; // FIXME: Get from user's home
  
  const authCode = await OAuthService.generateAuthorizationCode(
    userId,
    homeId,
    query.client_id,
    query.redirect_uri,
    query.scope
  );
  
  return reply.redirect(`${query.redirect_uri}?code=${authCode}&state=${query.state}`);
});

// 2. OAuth2 Token Endpoint
server.post('/oauth/token', async (request, reply) => {
  const body = request.body as any;
  
  if (body.grant_type === 'authorization_code') {
    const tokens = await OAuthService.exchangeCodeForToken(
      body.code,
      body.client_id,
      body.redirect_uri
    );
    
    if (!tokens) {
      return reply.status(401).send({ error: 'invalid_grant' });
    }
    
    return {
      token_type: 'Bearer',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
    };
  } else if (body.grant_type === 'refresh_token') {
    const tokens = await OAuthService.refreshAccessToken(body.refresh_token);
    
    if (!tokens) {
      return reply.status(401).send({ error: 'invalid_grant' });
    }
    
    return {
      token_type: 'Bearer',
      access_token: tokens.accessToken,
      expires_in: tokens.expiresIn,
    };
  }
  
  return reply.status(400).send({ error: 'unsupported_grant_type' });
});

// 3. Smart Home Fulfillment Endpoint
server.post('/smarthome', async (request, reply) => {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'unauthorized' });
  }
  
  const token = authHeader.substring(7);
  const verified = await OAuthService.verifyAccessToken(token);
  
  if (!verified) {
    return reply.status(401).send({ error: 'invalid_token' });
  }
  
  const homeId = verified.homeId;
  const body = request.body as any;
  
  // Process smart home intent with verified homeId
  // ... rest of implementation
});
```

---

### Step 4: Add Environment Variable

Add to `.env.example` and `.env`:

```bash
# OAuth JWT Secret (must match API JWT_SECRET)
RELAY_JWT_SECRET=CHANGE_ME_64_BYTE_HEX_SECRET_HERE
```

---

### Step 5: Testing (30 minutes)

1. **Test Authorization Flow:**
   ```bash
   # Request auth code
   curl "http://localhost:3000/oauth/authorize?client_id=test&redirect_uri=http://localhost/callback&state=abc&user_id=user1&home_id=HOME_123"
   
   # Should redirect with real code (not mock)
   ```

2. **Test Token Exchange:**
   ```bash
   curl -X POST http://localhost:3000/oauth/token \
     -H "Content-Type: application/json" \
     -d '{
       "grant_type": "authorization_code",
       "code": "<code_from_step_1>",
       "client_id": "test",
       "redirect_uri": "http://localhost/callback"
     }'
   
   # Should return JWT access token (not mock)
   ```

3. **Test Smart Home Request:**
   ```bash
   curl -X POST http://localhost:3000/smarthome \
     -H "Authorization: Bearer <access_token>" \
     -H "Content-Type: application/json" \
     -d '{"intent": "action.devices.SYNC"}'
   
   # Should work with verified token
   ```

4. **Test Invalid Token:**
   ```bash
   curl -X POST http://localhost:3000/smarthome \
     -H "Authorization: Bearer invalid_token" \
     -H "Content-Type: application/json" \
     -d '{"intent": "action.devices.SYNC"}'
   
   # Should return 401 Unauthorized
   ```

---

## Interim Workaround (Until Full Fix)

**Disable the OAuth endpoints entirely:**

```typescript
// In apps/relay/server.ts
server.get('/oauth/authorize', async (request, reply) => {
  return reply.status(503).send({ 
    error: 'OAuth not yet implemented - voice assistants temporarily disabled' 
  });
});

server.post('/oauth/token', async (request, reply) => {
  return reply.status(503).send({ 
    error: 'OAuth not yet implemented - voice assistants temporarily disabled' 
  });
});
```

**Add warning log on relay startup:**

```typescript
console.warn('⚠️  WARNING: OAuth authentication not implemented - voice assistants disabled');
console.warn('⚠️  See docs/RELAY_OAUTH_FIX.md for implementation guide');
```

---

## Security Checklist

After implementing the fix:

- [ ] Authorization codes expire after 10 minutes
- [ ] Authorization codes can only be used once
- [ ] Access tokens expire after 1 hour
- [ ] Refresh tokens can generate new access tokens
- [ ] All tokens stored in database with expiry tracking
- [ ] JWT secrets match between API and Relay
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Smart home requests verify bearer tokens
- [ ] No mock tokens remain in codebase
- [ ] Token revocation mechanism exists

---

## References

- OAuth 2.0 RFC: https://datatracker.ietf.org/doc/html/rfc6749
- Google Smart Home OAuth: https://developers.google.com/assistant/smarthome/develop/implement-oauth
- Alexa Account Linking: https://developer.amazon.com/docs/account-linking/understand-account-linking.html

---

**Status:** 🔴 **CRITICAL - IMPLEMENT IMMEDIATELY OR DISABLE OAUTH ENDPOINTS**
