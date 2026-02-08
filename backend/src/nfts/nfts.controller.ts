import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NftsService } from './nfts.service';
import { VerifyOwnershipDto } from './dto/verify-ownership.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('nfts')
@Controller('nfts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NftsController {
  constructor(private nftsService: NftsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all NFTs' })
  @ApiQuery({ name: 'collectionName', required: false })
  @ApiResponse({ status: 200, description: 'List of NFTs' })
  async findAll(@Query('collectionName') collectionName?: string) {
    return this.nftsService.findAll(collectionName);
  }

  @Post('verify-ownership')
  @ApiOperation({ summary: 'Verify NFT ownership' })
  @ApiResponse({ status: 200, description: 'Ownership verification result' })
  async verifyOwnership(@Body() verifyDto: VerifyOwnershipDto) {
    return this.nftsService.verifyOwnership(verifyDto);
  }
}
