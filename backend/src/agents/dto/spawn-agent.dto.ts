import { IsString, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SpawnAgentDto {
  @ApiProperty({ description: 'Room ID to spawn agent in' })
  @IsUUID()
  roomId: string;

  @ApiProperty({ description: 'Agent name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Agent avatar emoji', required: false })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ description: 'Agent role', enum: ['buyer', 'seller'] })
  @IsEnum(['buyer', 'seller'])
  role: 'buyer' | 'seller';

  @ApiProperty({ description: 'NFT ID (required for sellers)', required: false })
  @IsOptional()
  @IsUUID()
  nftId?: string;

  @ApiProperty({ description: 'Minimum acceptable price' })
  @IsNumber()
  minPrice: number;

  @ApiProperty({ description: 'Maximum willing price' })
  @IsNumber()
  maxPrice: number;

  @ApiProperty({ description: 'Starting offer price' })
  @IsNumber()
  startingPrice: number;

  @ApiProperty({ description: 'Trading strategy', enum: ['competitive', 'patient', 'aggressive', 'conservative', 'sniper'] })
  @IsEnum(['competitive', 'patient', 'aggressive', 'conservative', 'sniper'])
  strategy: string;

  @ApiProperty({ description: 'Communication personality', enum: ['formal', 'casual', 'professional', 'aggressive'] })
  @IsEnum(['formal', 'casual', 'professional', 'aggressive'])
  personality: string;
}
