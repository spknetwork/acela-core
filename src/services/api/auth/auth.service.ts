
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs'
import { UserRepository } from '../../../repositories/user/user.repository';

@Injectable()
export class AuthService {
  jwtService: JwtService;
  constructor(
    private readonly usersService: UserRepository,
    jwtService: JwtService
  ) {
    this.jwtService = jwtService;
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    console.log(user)
    //FIX login validation
    // console.log(user, pass)
    // console.log(user, bcrypt.compare(user.password, pass))
    // console.log("TEST")
      // return result;
    if (user && bcrypt.compare(user.password, pass)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    console.log(user)
    const payload = { username: user.email, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}