import { IsString, IsEthereumAddress } from 'class-validator';

export class VerifyRequestDto {
  @IsEthereumAddress()
  walletAddress: string;

  @IsString()
  signature: string;

  @IsString()
  nonce: string;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    walletAddress: string;
    createdAt: Date;
  };
}
