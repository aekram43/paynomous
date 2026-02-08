import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestApp, cleanupTestApp, authenticateUser, getAuthHeaders } from './helpers/test-helpers';

describe('Agents E2E Tests', () => {
  let testApp: ReturnType<typeof createTestApp> extends Promise<infer T> ? T : never;
  let authData: { accessToken: string; refreshToken: string; userId: string };

  beforeAll(async () => {
    testApp = await createTestApp();
    authData = await authenticateUser(testApp.supertest);
  });

  afterAll(async () => {
    await cleanupTestApp(testApp.app);
  });

  describe('POST /agents/spawn', () => {
    it('should spawn a new buyer agent', async () => {
      const response = await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Test Buyer Agent',
          avatar: '🤖',
          role: 'buyer',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 50,
          maxPrice: 100,
          startingPrice: 75,
          strategy: 'competitive',
          communicationStyle: 'professional',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Buyer Agent');
      expect(response.body.role).toBe('buyer');
      expect(response.body.status).toBe('active');
      expect(response.body).toHaveProperty('userId');
    });

    it('should spawn a new seller agent with NFT', async () => {
      const response = await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Test Seller Agent',
          avatar: '🎨',
          role: 'seller',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          nftId: global.__E2E_TEST_DATA__?.testNftId || '00000000-0000-0000-0000-000000000000',
          minPrice: 80,
          maxPrice: 120,
          startingPrice: 100,
          strategy: 'patient',
          communicationStyle: 'formal',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Seller Agent');
      expect(response.body.role).toBe('seller');
      expect(response.body.status).toBe('active');
      expect(response.body).toHaveProperty('nftId');
    });

    it('should return 400 for invalid role', async () => {
      await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Invalid Agent',
          role: 'invalid-role',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 50,
          maxPrice: 100,
          startingPrice: 75,
        })
        .expect(400);
    });

    it('should return 400 when minPrice > maxPrice', async () => {
      await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Invalid Price Agent',
          role: 'buyer',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 100,
          maxPrice: 50,
          startingPrice: 75,
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await testApp.supertest
        .post('/agents/spawn')
        .send({
          name: 'Unauthorized Agent',
          role: 'buyer',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 50,
          maxPrice: 100,
          startingPrice: 75,
        })
        .expect(401);
    });
  });

  describe('GET /agents/:id', () => {
    let agentId: string;

    beforeAll(async () => {
      // Create an agent to test
      const response = await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Agent to Get',
          avatar: '🔍',
          role: 'buyer',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 50,
          maxPrice: 100,
          startingPrice: 75,
          strategy: 'competitive',
          communicationStyle: 'casual',
        });
      agentId = response.body.id;
    });

    it('should return agent by ID', async () => {
      const response = await testApp.supertest
        .get(`/agents/${agentId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(agentId);
      expect(response.body.name).toBe('Agent to Get');
    });

    it('should return 404 for non-existent agent', async () => {
      await testApp.supertest
        .get('/agents/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await testApp.supertest
        .get('/agents/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /agents/my', () => {
    it('should return all agents for authenticated user', async () => {
      const response = await testApp.supertest
        .get('/agents/my')
        .set(getAuthHeaders(authData.accessToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((agent: any) => {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('role');
        expect(agent).toHaveProperty('status');
      });
    });

    it('should return 401 without authentication', async () => {
      await testApp.supertest
        .get('/agents/my')
        .expect(401);
    });
  });

  describe('DELETE /agents/:id', () => {
    let agentId: string;

    beforeAll(async () => {
      // Create an agent to delete
      const response = await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Agent to Delete',
          avatar: '🗑️',
          role: 'buyer',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 50,
          maxPrice: 100,
          startingPrice: 75,
          strategy: 'aggressive',
          communicationStyle: 'professional',
        });
      agentId = response.body.id;
    });

    it('should delete agent successfully', async () => {
      const response = await testApp.supertest
        .delete(`/agents/${agentId}`)
        .set(getAuthHeaders(authData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(agentId);
    });

    it('should return 404 for already deleted agent', async () => {
      await testApp.supertest
        .delete(`/agents/${agentId}`)
        .set(getAuthHeaders(authData.accessToken))
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await testApp.supertest
        .delete(`/agents/${agentId}`)
        .expect(401);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should complete full agent lifecycle', async () => {
      // Spawn agent
      const spawnResponse = await testApp.supertest
        .post('/agents/spawn')
        .set(getAuthHeaders(authData.accessToken))
        .send({
          name: 'Lifecycle Agent',
          avatar: '🔄',
          role: 'buyer',
          roomId: global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000',
          minPrice: 50,
          maxPrice: 100,
          startingPrice: 75,
          strategy: 'conservative',
          communicationStyle: 'formal',
        })
        .expect(201);

      const agentId = spawnResponse.body.id;

      // Get agent
      await testApp.supertest
        .get(`/agents/${agentId}`)
        .expect(200);

      // List my agents
      const myAgentsResponse = await testApp.supertest
        .get('/agents/my')
        .set(getAuthHeaders(authData.accessToken))
        .expect(200);

      const hasLifecycleAgent = myAgentsResponse.body.some(
        (a: any) => a.id === agentId && a.name === 'Lifecycle Agent',
      );
      expect(hasLifecycleAgent).toBe(true);

      // Delete agent
      await testApp.supertest
        .delete(`/agents/${agentId}`)
        .set(getAuthHeaders(authData.accessToken))
        .expect(200);
    });
  });
});
