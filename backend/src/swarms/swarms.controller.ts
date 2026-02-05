import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SwarmsService } from './swarms.service';
import { SpawnSwarmDto } from './dto/spawn-swarm.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('swarms')
@Controller('swarms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SwarmsController {
  constructor(private swarmsService: SwarmsService) {}

  @Post('spawn')
  @ApiOperation({ summary: 'Spawn a swarm of agents' })
  @ApiResponse({ status: 201, description: 'Swarm created successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async spawnSwarm(@Request() req, @Body() spawnDto: SpawnSwarmDto) {
    return this.swarmsService.spawnSwarm(req.user.userId, spawnDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get swarm details by ID' })
  @ApiResponse({ status: 200, description: 'Swarm details' })
  @ApiResponse({ status: 404, description: 'Swarm not found' })
  async findOne(@Param('id') id: string) {
    const swarm = await this.swarmsService.findOne(id);
    if (!swarm) {
      throw new NotFoundException(`Swarm with ID ${id} not found`);
    }
    return swarm;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update swarm status (pause/resume/stop)' })
  @ApiResponse({ status: 200, description: 'Swarm updated successfully' })
  @ApiResponse({ status: 404, description: 'Swarm not found' })
  async updateSwarm(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.swarmsService.updateSwarm(id, req.user.userId, body.status);
  }
}
