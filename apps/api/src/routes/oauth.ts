import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

export default async function oauthRoutes(server: FastifyInstance) {
  // GET /api/oauth/authorize
  server.get('/authorize', async (req, reply) => {
    const { client_id, redirect_uri, state, response_type } = req.query as any;

    if (!client_id || response_type !== 'code') {
      return reply.status(400).send({ error: 'Invalid request' });
    }

    const client = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } });
    if (!client || !client.redirectUris.includes(redirect_uri)) {
      return reply.status(400).send({ error: 'Invalid client or redirect URI' });
    }

    // 1. Authenticate user.
    // In a real OAuth flow, this page would check if the user is logged in.
    // If not, it redirects them to the login page.
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ error: 'Please log in to link your account to Google Home / Alexa.' });
    }

    // Normally we decode JWT here to get the real user ID
    // const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const userId = 'real_user_id'; // decoded.sub;

    const authorizationCode = crypto.randomBytes(16).toString('hex');
    
    // Save the authorization code in DB or Redis mapped to userId
    // e.g., await redis.setEx(`auth_code:${authCode}`, 300, userId);

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', authorizationCode);
    redirectUrl.searchParams.append('state', state);

    return reply.redirect(redirectUrl.toString());
  });

  // POST /api/oauth/token
  server.post('/token', async (req, reply) => {
    const { client_id, client_secret, grant_type, code, refresh_token } = req.body as any;

    const client = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } });
    if (!client || client.clientSecret !== client_secret) {
      return reply.status(401).send({ error: 'Invalid client credentials' });
    }

    if (grant_type === 'authorization_code') {
      // Validate code...
      
      const accessToken = crypto.randomBytes(32).toString('hex');
      const refreshToken = crypto.randomBytes(32).toString('hex');

      // Save tokens...
      
      return reply.send({
        token_type: 'Bearer',
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600
      });
    }

    if (grant_type === 'refresh_token') {
      // Validate refresh token...
      
      const newAccessToken = crypto.randomBytes(32).toString('hex');
      return reply.send({
        token_type: 'Bearer',
        access_token: newAccessToken,
        expires_in: 3600
      });
    }

    return reply.status(400).send({ error: 'Unsupported grant type' });
  });
}
