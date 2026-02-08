import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check endpoint (lightweight, no DB queries)
   * Returns 200 if service is running, 503 if unhealthy
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async getHealth() {
    return this.healthService.getBasicHealth();
  }

  /**
   * Detailed health check with all service statuses
   * Includes database, Redis, Rust service, and queue status
   */
  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detailed health check with all services' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  async getDetailedHealth() {
    return this.healthService.getDetailedHealth();
  }

  /**
   * Live readiness probe (for Kubernetes)
   * Returns 200 if service can accept traffic
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async getReadiness() {
    return this.healthService.getReadiness();
  }

  /**
   * Liveness probe (for Kubernetes)
   * Returns 200 if service is alive (not deadlocked)
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async getLiveness() {
    return this.healthService.getLiveness();
  }
}
