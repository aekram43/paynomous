import { IsString, IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOwnershipDto {
  @ApiProperty({ description: 'NFT collection address' })
  @IsEthereumAddress()
  collectionAddress: string;

  @ApiProperty({ description: 'NFT token ID' })
  @IsString()
  tokenId: string;

  @ApiProperty({ description: 'Wallet address to verify' })
  @IsEthereumAddress()
  walletAddress: string;
}
