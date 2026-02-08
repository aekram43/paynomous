import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { SpawnAgentDto } from './dto/spawn-agent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentSpawnRateLimit } from '../common/decorators/rate-limit.decorator';

@ApiTags('agents')
@Controller('agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post('spawn')
  @AgentSpawnRateLimit()
  @ApiOperation({ summary: 'Spawn a new AI agent' })
  @ApiResponse({ status: 201, description: 'Agent created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async spawnAgent(@Request() req, @Body() spawnDto: SpawnAgentDto) {
    return this.agentsService.spawnAgent(req.user.userId, spawnDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details by ID' })
  @ApiResponse({ status: 200, description: 'Agent details' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async findOne(@Param('id') id: string) {
    const agent = await this.agentsService.findOne(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agent' })
  @ApiResponse({ status: 200, description: 'Agent deleted successfully' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async deleteAgent(@Request() req, @Param('id') id: string) {
    return this.agentsService.deleteAgent(id, req.user.userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get all agents for authenticated user' })
  @ApiResponse({ status: 200, description: 'List of user agents' })
  async findMyAgents(@Request() req) {
    return this.agentsService.findMyAgents(req.user.userId);
  }
}
