import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { server } from '../src/server'; // Assumes server is exported

describe('GET /api/telemetry/energy', () => {
  beforeAll(async () => {
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return 401 Unauthorized if no JWT token is provided', async () => {
    const response = await supertest(server.server)
      .get('/api/telemetry/energy');
    
    expect(response.status).toBe(401);
  });

  it('should return 403 or 400 for malformed token', async () => {
    const response = await supertest(server.server)
      .get('/api/telemetry/energy')
      .set('Authorization', `Bearer invalid-token`);
    
    expect(response.status).toBeGreaterThanOrEqual(400); // 401 or 400
  });

  it('should return paginated data with nextCursor for valid requests', async () => {
    // Generate valid JWT for testing using the server's fastify-jwt instance
    const token = server.jwt.sign({ id: 'test-user', role: 'SUPER_OWNER' });

    const response = await supertest(server.server)
      .get('/api/telemetry/energy?limit=10')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('nextCursor');
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
