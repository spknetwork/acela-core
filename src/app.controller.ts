import { Controller, Get, Request, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './services/api/auth/jwt-auth.guard';
import { LocalAuthGuard } from './services/api/auth/local-auth.guard';
import { AuthService } from './services/api/auth/auth.service';

@Controller()
export class AppController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('auth/login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('register')
  async register(@Request() req) {
    return this.authService.register(req.body.username, req.body.password);
  }

  @Post('verifyPosting')
  async verifyPosting(@Request() req) {
    return this.authService.verifyPosting(req.body.username, req.body.private_posting_key);
  }
}