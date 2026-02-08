# Metrics Module

This module collects and exposes application metrics for monitoring.

## Key Endpoints

- `GET /metrics` - Get all metrics as JSON
- `GET /metrics/prometheus` - Get metrics in Prometheus text format

## Metrics Collected

1. **API Metrics**: Response times (p50, p95, p99, avg), request count, error rate
2. **Queue Metrics**: Waiting, active, completed, failed job counts per queue
3. **Agent Metrics**: Active agents, total agents, agents by status
4. **Deal Metrics**: Total, completed, failed deals, completion rate, avg negotiation time
5. **Room Metrics**: Active rooms, total rooms
6. **System Metrics**: Uptime, memory usage, CPU usage

## Important Patterns

1. **Global Module**: The MetricsModule is marked as `@Global()` so its service can be used anywhere without explicit import in other modules.

2. **Response Time Tracking**: The `MetricsMiddleware` automatically tracks request/response times for all API calls. Request IDs are generated and tracked.

3. **Data Retention**: Only the last 1000 response time measurements are kept to manage memory.

## Dependencies

- `RedisModule` - For Redis client access
- `QueuesModule` - For queue metrics
- Direct `PrismaClient` instantiation for database queries

## Usage in Middleware

To use metrics in custom middleware:
```typescript
import { MetricsMiddleware } from './metrics.middleware';
MetricsMiddleware.setMetricsService(metricsService);
```
