import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AlertsService, Alert, AlertRule } from './alerts.service';

@ApiTags('Health & Monitoring')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Get all active alerts
   */
  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all active alerts' })
  @ApiResponse({ status: 200, description: 'List of active alerts', type: [Object] })
  getActiveAlerts(): Alert[] {
    return this.alertsService.getActiveAlerts();
  }

  /**
   * Get all alerts (including resolved)
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all alerts including resolved' })
  @ApiResponse({ status: 200, description: 'List of all alerts', type: [Object] })
  getAllAlerts(): Alert[] {
    return this.alertsService.getAllAlerts();
  }

  /**
   * Get alert configuration
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get alert configuration' })
  @ApiResponse({ status: 200, description: 'Alert rules configuration', type: [Object] })
  getAlertConfig(): AlertRule[] {
    return this.alertsService.getAlertConfig();
  }

  /**
   * Update an alert rule
   */
  @Post('config/:name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update alert rule configuration' })
  @ApiResponse({ status: 200, description: 'Alert rule updated' })
  updateAlertRule(
    @Param('name') name: string,
    @Body() updates: Partial<AlertRule>,
  ): { message: string } {
    this.alertsService.updateAlertRule(name, updates);
    return { message: `Alert rule ${name} updated successfully` };
  }

  /**
   * Manually trigger an alert check (for testing)
   */
  @Post('check/:name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger alert check' })
  @ApiResponse({ status: 200, description: 'Alert check result' })
  async manualCheck(@Param('name') name: string): Promise<{ triggered: boolean }> {
    const triggered = await this.alertsService.manualCheck(name);
    return { triggered };
  }
}
