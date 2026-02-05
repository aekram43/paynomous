import { IsString, IsEthereumAddress } from 'class-validator';

export class ChallengeRequestDto {
  @IsEthereumAddress()
  walletAddress: string;
}

export class ChallengeResponseDto {
  nonce: string;
  message: string;
  expiresAt: string;
}
