import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

@ApiTags('Health & Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Get all application metrics
   * Returns API response times, queue lengths, active agents, deal completion rate
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({ status: 200, description: 'Application metrics' })
  async getMetrics() {
    return this.metricsService.getAllMetrics();
  }

  /**
   * Get metrics in Prometheus format
   * Returns plain text metrics for Prometheus scraping
   */
  @Get('prometheus')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get metrics in Prometheus format' })
  @ApiResponse({ status: 200, description: 'Prometheus-format metrics', type: String })
  async getPrometheusMetrics() {
    const metrics = await this.metricsService.getAllMetrics();
    return this.metricsService.formatAsPrometheus(metrics);
  }
}
