# Alerts Module

This module provides alerting and notification capabilities for monitoring system health.

## Key Endpoints

- `GET /alerts/active` - Get all active (unresolved) alerts
- `GET /alerts/all` - Get all alerts including resolved
- `GET /alerts/config` - Get alert rule configuration
- `POST /alerts/config/:name` - Update an alert rule
- `POST /alerts/check/:name` - Manually trigger an alert check

## Alert Rules

Alerts are checked every 30 seconds using `@nestjs/schedule` cron jobs. Default rules include:

1. **service_down** (Critical) - Overall service health check
2. **high_error_rate** (Warning) - API error rate > 5%
3. **slow_response_time** (Warning) - P95 response time > 1s
4. **high_memory_usage** (Warning) - Memory usage > 85%
5. **critical_memory_usage** (Critical) - Memory usage > 95%
6. **queue_backlog** (Warning) - Queue has > 100 waiting jobs
7. **high_queue_failure_rate** (Warning) - Queue failure rate > 10%
8. **database_connection_failure** (Critical) - Database is unhealthy
9. **redis_connection_failure** (Critical) - Redis is unhealthy
10. **rust_service_failure** (Critical) - Rust service is unhealthy

## Important Patterns

1. **Scheduled Jobs**: Uses `@nestjs/schedule` with `@Cron(CronExpression.EVERY_30_SECONDS)` for periodic checks.

2. **Alert State Management**: Alerts are tracked in memory as `Map<string, Alert>`. New alerts trigger notifications, resolved alerts trigger resolution notifications.

3. **Severity Levels**: Alerts have two severity levels:
   - `warning` - Logged as warnings
   - `critical` - Logged as critical errors via `AppLoggerService.logCritical()`

## Notification Channels

Currently, alerts are logged. Future implementations can add:
- Email notifications (SendGrid/Mailgun)
- Slack webhooks
- PagerDuty integration
- Custom webhooks

## Dependencies

- `ScheduleModule` from `@nestjs/schedule` - For cron jobs
- `HealthModule` - For health-based alerts
- `MetricsModule` - For metrics-based alerts
- `LoggerModule` - For alert logging

## Environment Variables

- `ALERT_CHECK_INTERVAL` - Alert check interval in seconds (default: 30)
- `ALERT_EMAIL_ENABLED` - Enable email notifications
- `ALERT_EMAIL_TO` - Destination email for alerts
- `ALERT_SLACK_WEBHOOK_URL` - Slack webhook for alerts
