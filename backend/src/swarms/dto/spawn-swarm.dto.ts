import { IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SpawnSwarmDto {
  @ApiProperty({ description: 'Room ID to spawn swarm in' })
  @IsUUID()
  roomId: string;

  @ApiProperty({ description: 'Swarm preset', enum: ['small_test', 'balanced_market', 'high_competition', 'buyers_market'] })
  @IsEnum(['small_test', 'balanced_market', 'high_competition', 'buyers_market'])
  preset: string;

  @ApiProperty({ description: 'Optional swarm name' })
  @IsString()
  name: string;
}
