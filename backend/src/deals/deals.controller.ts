import { Controller, Get, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('deals')
@Controller('deals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DealsController {
  constructor(private dealsService: DealsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get deal details by ID' })
  @ApiResponse({ status: 200, description: 'Deal details' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async findOne(@Param('id') id: string) {
    const deal = await this.dealsService.findOne(id);
    if (!deal) {
      throw new NotFoundException(`Deal with ID ${id} not found`);
    }
    return deal;
  }

  @Get('my')
  @ApiOperation({ summary: 'Get all deals for authenticated user' })
  @ApiResponse({ status: 200, description: 'List of user deals' })
  async findMyDeals(@Request() req) {
    return this.dealsService.findMyDeals(req.user.userId);
  }
}
