import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestApp, cleanupTestApp, authenticateUser } from './helpers/test-helpers';

describe('Authentication E2E Tests', () => {
  let testApp: ReturnType<typeof createTestApp> extends Promise<infer T> ? T : never;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(testApp.app);
  });

  describe('POST /auth/challenge', () => {
    it('should generate a challenge with nonce and message', async () => {
      const response = await testApp.supertest
        .post('/auth/challenge')
        .send({ walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
        .expect(200);

      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.nonce).toMatch(/^[a-f0-9-]{36}$/); // UUID format
      expect(response.body.message).toContain('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    });

    it('should return 400 for invalid wallet address', async () => {
      await testApp.supertest
        .post('/auth/challenge')
        .send({ walletAddress: 'invalid-address' })
        .expect(400);
    });

    it('should return 400 for missing wallet address', async () => {
      await testApp.supertest
        .post('/auth/challenge')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/verify', () => {
    it('should verify signature and return tokens', async () => {
      const authData = await authenticateUser(testApp.supertest);

      expect(authData.accessToken).toBeDefined();
      expect(authData.refreshToken).toBeDefined();
      expect(authData.userId).toBeDefined();
    });

    it('should return 401 for invalid signature', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const challengeResponse = await testApp.supertest
        .post('/auth/challenge')
        .send({ walletAddress })
        .expect(200);

      await testApp.supertest
        .post('/auth/verify')
        .send({
          walletAddress,
          signature: '0x' + '1'.repeat(130), // Invalid signature
          nonce: challengeResponse.body.nonce,
        })
        .expect(401);
    });

    it('should return 400 for expired nonce', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
      const expiredNonce = '00000000-0000-0000-0000-000000000000';

      await testApp.supertest
        .post('/auth/verify')
        .send({
          walletAddress,
          signature: '0x' + '1'.repeat(130),
          nonce: expiredNonce,
        })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const authData = await authenticateUser(testApp.supertest);

      const refreshResponse = await testApp.supertest
        .post('/auth/refresh')
        .send({ refreshToken: authData.refreshToken })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      await testApp.supertest
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user data with valid JWT', async () => {
      const authData = await authenticateUser(testApp.supertest);

      const response = await testApp.supertest
        .get('/auth/me')
        .set('Authorization', `Bearer ${authData.accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('walletAddress');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should return 401 without authentication', async () => {
      await testApp.supertest.get('/auth/me').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await testApp.supertest
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
