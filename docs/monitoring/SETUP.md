# Monitoring and Alerting Setup Guide

This guide explains how to set up monitoring and alerting for the Agentrooms application.

## Overview

The Agentrooms application includes built-in monitoring capabilities:

- **Health Check Endpoints**: `/health`, `/health/detailed`, `/health/ready`, `/health/live`
- **Metrics Endpoint**: `/metrics` (JSON format) and `/metrics/prometheus` (Prometheus format)
- **Alerts Endpoints**: `/alerts/active`, `/alerts/config`
- **Built-in Alert System**: Configurable alert rules with automatic checking

## Quick Start with Prometheus

### 1. Install Prometheus

```bash
# On macOS
brew install prometheus

# On Linux
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64
```

### 2. Configure Prometheus

Copy the provided configuration files:

```bash
cp docs/monitoring/prometheus.yml /etc/prometheus/prometheus.yml
cp docs/monitoring/alert_rules.yml /etc/prometheus/alert_rules.yml
```

### 3. Start Prometheus

```bash
prometheus --config.file=/etc/prometheus/prometheus.yml
```

Prometheus will be available at http://localhost:9090

### 4. Verify Metrics are Being Scraped

1. Go to http://localhost:9090
2. Click "Targets" in the menu
3. Verify that `agentrooms-backend` is "UP"

## Grafana Dashboard Setup

### 1. Install Grafana

```bash
# On macOS
brew install grafana

# On Linux
sudo apt-get install grafana
```

### 2. Start Grafana

```bash
# On macOS
brew services start grafana

# On Linux
sudo systemctl start grafana
```

Grafana will be available at http://localhost:3000 (default credentials: admin/admin)

### 3. Add Prometheus as Data Source

1. Go to Configuration → Data Sources → Add data source
2. Select "Prometheus"
3. Set URL to `http://localhost:9090`
4. Click "Save & Test"

### 4. Import the Dashboard

1. Go to Dashboards → Import
2. Upload `docs/monitoring/grafana-dashboard.json`
3. Select "Prometheus" as the data source
4. Click "Import"

## Built-in Alert System

The application has a built-in alert system that runs checks every 30 seconds.

### Available Alert Rules

| Rule Name | Severity | Trigger Condition |
|-----------|----------|-------------------|
| service_down | critical | Service health check fails |
| high_error_rate | warning | API error rate > 5% |
| slow_response_time | warning | P95 response time > 1s |
| high_memory_usage | warning | Memory usage > 85% |
| critical_memory_usage | critical | Memory usage > 95% |
| queue_backlog | warning | Queue waiting jobs > 100 |
| high_queue_failure_rate | warning | Queue failure rate > 10% |
| database_connection_failure | critical | Database unreachable |
| redis_connection_failure | critical | Redis unreachable |
| rust_service_failure | critical | Rust service unreachable |

### Configure Alert Notifications

Alert notifications can be configured via environment variables:

```bash
# Email notifications (using SendGrid or similar)
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_TO=ops@example.com
ALERT_EMAIL_FROM=noreply@example.com
SENDGRID_API_KEY=your-sendgrid-key

# Slack notifications
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty notifications
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key
PAGERDUTY_API_KEY=your-pagerduty-api-key
```

### View Active Alerts

```bash
# Get all active alerts
curl http://localhost:3000/alerts/active

# Get all alerts (including resolved)
curl http://localhost:3000/alerts/all

# Get alert configuration
curl http://localhost:3000/alerts/config
```

### Manually Trigger Alert Check

```bash
# Test a specific alert rule
curl -X POST http://localhost:3000/alerts/check/service_down
```

## Uptime Monitoring

For production uptime monitoring, consider using:

### 1. UptimeRobot (Free Tier Available)

1. Sign up at https://uptimerobot.com
2. Add a new monitor:
   - Type: HTTP
   - URL: `https://your-domain.com/health`
   - Check interval: 5 minutes
3. Configure alerts (email, Slack, SMS, etc.)

### 2. Pingdom (Paid)

1. Sign up at https://www.pingdom.com
2. Create Uptime monitor
3. Set up alert integrations

### 3. Status Page

Create a public status page using:

- **Statuspage.io** (Atlassian)
- **StatusCake**
- **Upptime** (Open-source GitHub-based status page)

## Health Check Endpoints

### Basic Health Check
```bash
curl http://localhost:3000/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-02-06T10:00:00.000Z",
  "uptime": 3600000
}
```

### Detailed Health Check
```bash
curl http://localhost:3000/health/detailed
```
Response includes database, Redis, Rust service, and queue statuses.

### Kubernetes Probes

```yaml
# Readiness probe
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Metrics Reference

### API Metrics

- `api_response_time_p50`: 50th percentile response time (ms)
- `api_response_time_p95`: 95th percentile response time (ms)
- `api_response_time_p99`: 99th percentile response time (ms)
- `api_response_time_avg`: Average response time (ms)
- `api_request_count`: Total API requests
- `api_error_rate`: API error rate (%)

### Queue Metrics

- `queue_waiting{name="queue-name"}`: Jobs waiting in queue
- `queue_active{name="queue-name"}`: Active jobs being processed
- `queue_completed{name="queue-name"}`: Total completed jobs
- `queue_failed{name="queue-name"}`: Total failed jobs

### Agent Metrics

- `agents_active`: Number of active agents
- `agents_total`: Total number of agents
- `agents_by_status{status="status"}`: Agents by status
- `agents_by_strategy{strategy="strategy"}`: Agents by strategy

### Deal Metrics

- `deals_total`: Total number of deals
- `deals_completed`: Total completed deals
- `deals_failed`: Total failed deals
- `deals_completion_rate`: Deal completion rate (%)
- `deals_avg_negotiation_time`: Average negotiation time (seconds)

### System Metrics

- `system_uptime_ms`: System uptime in milliseconds
- `system_memory_used_mb`: Memory used (MB)
- `system_memory_total_mb`: Total memory (MB)
- `system_memory_percentage`: Memory usage (%)
- `system_cpu_usage_seconds`: CPU usage (seconds)

## Troubleshooting

### Metrics Not Appearing in Prometheus

1. Check Prometheus targets: http://localhost:9090/targets
2. Verify the metrics endpoint is accessible:
   ```bash
   curl http://localhost:3000/metrics/prometheus
   ```
3. Check Prometheus logs for errors

### Alert Rules Not Working

1. Verify alert syntax:
   ```bash
   promtool check rules /etc/prometheus/alert_rules.yml
   ```
2. Check Prometheus UI: http://localhost:9090/alerts
3. Verify alert expression returns data:
   ```bash
   curl 'http://localhost:9090/api/v1/query?expr=up{job="agentrooms-backend"}'
   ```

### High Memory Usage

1. Check the metrics dashboard for memory trends
2. Review application logs for memory leaks
3. Consider increasing the memory limit in docker-compose.yml

## Best Practices

1. **Set up alerts before you need them**: Configure alerting early to catch issues proactively
2. **Use multiple notification channels**: Don't rely on a single notification method
3. **Test alerts regularly**: Verify alert notifications are working
4. **Review dashboards weekly**: Look for trends and anomalies
5. **Keep alert thresholds realistic**: Avoid alert fatigue by setting appropriate thresholds
6. **Document incident response procedures**: Have runbooks for common issues

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [NestJS Terminus Health Checks](https://docs.nestjs.com/recipes/terminus)
