import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestApp, cleanupTestApp, authenticateUser, getAuthHeaders } from './helpers/test-helpers';

describe('Rooms E2E Tests', () => {
  let testApp: ReturnType<typeof createTestApp> extends Promise<infer T> ? T : never;
  let authData: { accessToken: string; refreshToken: string; userId: string };

  beforeAll(async () => {
    testApp = await createTestApp();
    authData = await authenticateUser(testApp.supertest);
  });

  afterAll(async () => {
    await cleanupTestApp(testApp.app);
  });

  describe('GET /rooms', () => {
    it('should return all rooms', async () => {
      const response = await testApp.supertest
        .get('/rooms')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      if (response.body.length > 0) {
        const room = response.body[0];
        expect(room).toHaveProperty('id');
        expect(room).toHaveProperty('name');
        expect(room).toHaveProperty('collection');
        expect(room).toHaveProperty('status');
      }
    });

    it('should return rooms with correct structure', async () => {
      const response = await testApp.supertest
        .get('/rooms')
        .expect(200);

      response.body.forEach((room: any) => {
        expect(room.id).toMatch(/^[a-f0-9-]{36}$/);
        expect(typeof room.name).toBe('string');
        expect(typeof room.collection).toBe('string');
        expect(['active', 'completed', 'archived']).toContain(room.status);
        expect(room).toHaveProperty('createdAt');
      });
    });
  });

  describe('GET /rooms/:id', () => {
    it('should return room by ID', async () => {
      const roomId = global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000';

      const response = await testApp.supertest
        .get(`/rooms/${roomId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(roomId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('collection');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent room', async () => {
      await testApp.supertest
        .get('/rooms/00000000-0000-0000-0000-ffffffffffff')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await testApp.supertest
        .get('/rooms/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /rooms/:id/stats', () => {
    it('should return room statistics', async () => {
      const roomId = global.__E2E_TEST_DATA__?.testRoomId || '00000000-0000-0000-0000-000000000000';

      const response = await testApp.supertest
        .get(`/rooms/${roomId}/stats`)
        .expect(200);

      expect(response.body).toHaveProperty('floorPrice');
      expect(response.body).toHaveProperty('topBid');
      expect(response.body).toHaveProperty('activeBuyers');
      expect(response.body).toHaveProperty('activeSellers');
      expect(response.body).toHaveProperty('totalAgents');
      expect(response.body).toHaveProperty('dealsCompleted');

      expect(typeof response.body.floorPrice).toBe('number');
      expect(typeof response.body.topBid).toBe('number');
      expect(typeof response.body.activeBuyers).toBe('number');
      expect(typeof response.body.activeSellers).toBe('number');
      expect(typeof response.body.totalAgents).toBe('number');
      expect(typeof response.body.dealsCompleted).toBe('number');
    });

    it('should return 404 for non-existent room stats', async () => {
      await testApp.supertest
        .get('/rooms/00000000-0000-0000-0000-ffffffffffff/stats')
        .expect(404);
    });
  });

  describe('Room Data Consistency', () => {
    it('should maintain consistency between room list and detail', async () => {
      const roomsResponse = await testApp.supertest
        .get('/rooms')
        .expect(200);

      if (roomsResponse.body.length > 0) {
        const roomId = roomsResponse.body[0].id;

        const detailResponse = await testApp.supertest
          .get(`/rooms/${roomId}`)
          .expect(200);

        expect(detailResponse.body.id).toBe(roomsResponse.body[0].id);
        expect(detailResponse.body.name).toBe(roomsResponse.body[0].name);
        expect(detailResponse.body.collection).toBe(roomsResponse.body[0].collection);
      }
    });
  });
});
