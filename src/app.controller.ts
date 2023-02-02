import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { LocalAuthGuard } from './auth/local-auth.guard';
// import { AuthService } from './auth/auth.service';

@Controller()
export class AppController {
    @Post('auth/login')
    @UseGuards(LocalAuthGuard)
    async login(@Request() req) {
      console.log(req.user)
      console.log('user printed?')
      console.log(req)
      return req.user;
    }
  }