import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';
import { Wallet, verifyMessage } from 'ethers';

export interface TestApp {
  app: INestApplication;
  supertest: request.SuperAgentTest;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Set up the same configuration as main.ts
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Enable CORS for testing
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Enable validation pipe
  app.useGlobalPipes(
    new (require('@nestjs/common').ValidationPipe)({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();

  return {
    app,
    supertest: request(app.getHttpServer()),
  };
}

export async function cleanupTestApp(app: INestApplication): Promise<void> {
  await app.close();
}

export async function authenticateUser(
  supertest: request.SuperAgentTest,
  walletAddress?: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const wallet = walletAddress
    ? new Wallet(walletAddress.substring(0, 66) + '1'.repeat(64))
    : Wallet.createRandom();

  // Step 1: Get challenge
  const challengeResponse = await supertest
    .post('/auth/challenge')
    .send({ walletAddress: wallet.address })
    .expect(200);

  expect(challengeResponse.body).toHaveProperty('nonce');
  expect(challengeResponse.body).toHaveProperty('message');
  expect(challengeResponse.body).toHaveProperty('expiresAt');

  const { message } = challengeResponse.body;

  // Step 2: Sign the challenge
  const signature = await wallet.signMessage(message);

  // Step 3: Verify signature and get tokens
  const verifyResponse = await supertest
    .post('/auth/verify')
    .send({
      walletAddress: wallet.address,
      signature,
      nonce: challengeResponse.body.nonce,
    })
    .expect(200);

  expect(verifyResponse.body).toHaveProperty('accessToken');
  expect(verifyResponse.body).toHaveProperty('refreshToken');
  expect(verifyResponse.body).toHaveProperty('user');

  return {
    accessToken: verifyResponse.body.accessToken,
    refreshToken: verifyResponse.body.refreshToken,
    userId: verifyResponse.body.user.id,
  };
}

export function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
