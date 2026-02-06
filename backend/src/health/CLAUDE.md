# Health Module

This module provides comprehensive health check endpoints for monitoring service status.

## Key Endpoints

- `GET /health` - Basic health check (lightweight, returns immediately)
- `GET /health/detailed` - Full health check with all service statuses
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

## Important Patterns

1. **Prisma Client Usage**: This codebase uses direct `PrismaClient` instantiation in services, not a shared module. Each service creates its own instance:
   ```typescript
   import { PrismaClient } from '@prisma/client';
   private readonly prisma: PrismaClient = new PrismaClient();
   ```

2. **Queue Injection**: All BullMQ queues are injected using `@InjectQueue('queue-name')` decorator:
   ```typescript
   @InjectQueue('glm-requests') private readonly glmQueue: Queue
   ```

3. **Health Status Levels**: Services can be `healthy`, `unhealthy`, or `degraded` based on latency:
   - Database: degraded if latency > 500ms
   - Redis: degraded if latency > 100ms
   - Rust Service: degraded if latency > 200ms

## Dependencies

- `RedisModule` - For Redis health checks
- `RustModule` - For Rust service health checks
- `QueuesModule` - For queue status monitoring
