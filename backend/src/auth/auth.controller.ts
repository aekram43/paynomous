import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChallengeRequestDto, ChallengeResponseDto } from './dto/challenge.dto';
import { VerifyRequestDto, AuthResponseDto } from './dto/verify.dto';
import { RefreshRequestDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('challenge')
  async challenge(@Body() body: ChallengeRequestDto): Promise<ChallengeResponseDto> {
    return this.authService.generateChallenge(body.walletAddress);
  }

  @Post('verify')
  async verify(@Body() body: VerifyRequestDto): Promise<AuthResponseDto> {
    return this.authService.verifySignature(
      body.walletAddress,
      body.signature,
      body.nonce,
    );
  }

  @Post('refresh')
  async refresh(@Body() body: RefreshRequestDto) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return this.authService.getUserById(req.user.userId);
  }
}
