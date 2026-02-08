import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppLoggerService } from '../logger/logger.service';
import { HealthService } from '../health/health.service';
import { MetricsService } from '../metrics/metrics.service';

export interface AlertRule {
  name: string;
  enabled: boolean;
  threshold: number;
  severity: 'warning' | 'critical';
  checkFn: () => Promise<boolean>;
  message: string;
}

export interface Alert {
  id: string;
  rule: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private alerts: Map<string, Alert> = new Map();
  private alertCounter = 0;
  private alertConfig: AlertRule[] = [];

  constructor(
    private readonly appLogger: AppLoggerService,
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
  ) {
    this.initializeAlertRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    this.alertConfig = [
      {
        name: 'service_down',
        enabled: true,
        threshold: 0,
        severity: 'critical',
        checkFn: async () => {
          const health = await this.healthService.getDetailedHealth();
          return health.status === 'unhealthy';
        },
        message: 'Service is unhealthy - one or more critical services are down',
      },
      {
        name: 'high_error_rate',
        enabled: true,
        threshold: 5, // 5% error rate
        severity: 'warning',
        checkFn: async () => {
          const metrics = await this.metricsService.getAllMetrics();
          return metrics.api.errorRate > 5;
        },
        message: 'High API error rate detected',
      },
      {
        name: 'slow_response_time',
        enabled: true,
        threshold: 1000, // 1 second
        severity: 'warning',
        checkFn: async () => {
          const metrics = await this.metricsService.getAllMetrics();
          return metrics.api.responseTimes.p95 > 1000;
        },
        message: 'API response times are degraded (P95 > 1s)',
      },
      {
        name: 'high_memory_usage',
        enabled: true,
        threshold: 85, // 85%
        severity: 'warning',
        checkFn: async () => {
          const metrics = await this.metricsService.getAllMetrics();
          return metrics.system.memory.percentage > 85;
        },
        message: 'High memory usage detected (>85%)',
      },
      {
        name: 'critical_memory_usage',
        enabled: true,
        threshold: 95, // 95%
        severity: 'critical',
        checkFn: async () => {
          const metrics = await this.metricsService.getAllMetrics();
          return metrics.system.memory.percentage > 95;
        },
        message: 'Critical memory usage detected (>95%)',
      },
      {
        name: 'queue_backlog',
        enabled: true,
        threshold: 100, // 100 jobs
        severity: 'warning',
        checkFn: async () => {
          const metrics = await this.metricsService.getAllMetrics();
          return metrics.queues.some((q) => q.waiting > 100);
        },
        message: 'Queue backlog detected (>100 jobs waiting)',
      },
      {
        name: 'high_queue_failure_rate',
        enabled: true,
        threshold: 10, // 10% failure rate
        severity: 'warning',
        checkFn: async () => {
          const metrics = await this.metricsService.getAllMetrics();
          return metrics.queues.some((q) => {
            const total = q.completed + q.failed;
            return total > 0 && (q.failed / total) * 100 > 10;
          });
        },
        message: 'High queue failure rate detected (>10%)',
      },
      {
        name: 'database_connection_failure',
        enabled: true,
        threshold: 0,
        severity: 'critical',
        checkFn: async () => {
          const health = await this.healthService.getDetailedHealth();
          return health.services.database.status === 'unhealthy';
        },
        message: 'Database connection failure detected',
      },
      {
        name: 'redis_connection_failure',
        enabled: true,
        threshold: 0,
        severity: 'critical',
        checkFn: async () => {
          const health = await this.healthService.getDetailedHealth();
          return health.services.redis.status === 'unhealthy';
        },
        message: 'Redis connection failure detected',
      },
      {
        name: 'rust_service_failure',
        enabled: true,
        threshold: 0,
        severity: 'critical',
        checkFn: async () => {
          const health = await this.healthService.getDetailedHealth();
          return health.services.rustService.status === 'unhealthy';
        },
        message: 'Rust service failure detected',
      },
    ];
  }

  /**
   * Run alert checks every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkAlerts(): Promise<void> {
    for (const rule of this.alertConfig) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const triggered = await rule.checkFn();
        const alertKey = rule.name;

        if (triggered) {
          // Alert is still active
          if (!this.alerts.has(alertKey)) {
            // New alert - create and notify
            this.createAlert(rule);
          }
        } else {
          // Alert is no longer active - resolve it
          if (this.alerts.has(alertKey)) {
            this.resolveAlert(alertKey);
          }
        }
      } catch (error) {
        this.logger.error(`Error checking alert rule ${rule.name}: ${error.message}`);
      }
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(rule: AlertRule): void {
    const alert: Alert = {
      id: `alert-${++this.alertCounter}`,
      rule: rule.name,
      severity: rule.severity,
      message: rule.message,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.alerts.set(rule.name, alert);

    // Log the alert
    if (rule.severity === 'critical') {
      this.appLogger.logCritical(`[ALERT] ${rule.name}: ${rule.message}`);
    } else {
      this.appLogger.warn(`[ALERT] ${rule.name}: ${rule.message}`);
    }

    // Send notifications (placeholder for email/Slack/webhook)
    this.sendAlertNotification(alert);
  }

  /**
   * Resolve an active alert
   */
  private resolveAlert(ruleName: string): void {
    const alert = this.alerts.get(ruleName);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();

      this.appLogger.log(`[ALERT RESOLVED] ${ruleName}: ${alert.message}`);

      // Send resolution notification
      this.sendAlertResolutionNotification(alert);
    }
  }

  /**
   * Send alert notification (email, Slack, webhook)
   * This is a placeholder - implement actual notification channels
   */
  private sendAlertNotification(alert: Alert): void {
    // Log notification for now
    this.logger.log(
      `NOTIFICATION: [${alert.severity.toUpperCase()}] ${alert.rule} - ${alert.message}`,
    );

    // TODO: Implement actual notifications:
    // - Email via SendGrid/Mailgun
    // - Slack webhook
    // - PagerDuty integration
    // - Custom webhook
  }

  /**
   * Send alert resolution notification
   */
  private sendAlertResolutionNotification(alert: Alert): void {
    this.logger.log(`NOTIFICATION: [RESOLVED] ${alert.rule} - ${alert.message}`);

    // TODO: Implement resolution notifications
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolved);
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alert configuration
   */
  getAlertConfig(): AlertRule[] {
    return this.alertConfig;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(name: string, updates: Partial<AlertRule>): void {
    const rule = this.alertConfig.find((r) => r.name === name);
    if (rule) {
      Object.assign(rule, updates);
      this.logger.log(`Alert rule ${name} updated: ${JSON.stringify(updates)}`);
    }
  }

  /**
   * Manually trigger alert check for testing
   */
  async manualCheck(ruleName: string): Promise<boolean> {
    const rule = this.alertConfig.find((r) => r.name === ruleName);
    if (rule) {
      return await rule.checkFn();
    }
    throw new Error(`Alert rule ${ruleName} not found`);
  }
}
