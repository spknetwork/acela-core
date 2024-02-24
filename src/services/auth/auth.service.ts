
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs'
import { UserAccountRepository } from '../../repositories/userAccount/user-account.repository';
import { v4 as uuid } from 'uuid'
import { SessionRepository } from '../../repositories/session/session.repository';

@Injectable()
export class AuthService {
  jwtService: JwtService;
  constructor(
    private readonly userAccountRepository: UserAccountRepository,
    private readonly sessionRepository: SessionRepository,
    jwtService: JwtService
  ) {
    this.jwtService = jwtService;
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userAccountRepository.findOne(email);
    console.log(user)
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

  async authenticateUser(account: string) {
    const id = uuid()
    const access_token = await this.jwtService.sign({
      id: id,
      type: 'singleton',
      sub: `singleton/${account}`,
      username: account,
    })

    await this.sessionRepository.insertOne({
      id: id,
      type: 'singleton',
      sub: `singleton/${account}`,
    })

    return {
      access_token,
    }
  }

  async createSession(id: string, account: string) {
    return await this.sessionRepository.insertOne({
      id,
      type: 'singleton',
      sub: `singleton/${account}`
    });
  }

  async createUser(email: string, hashedPassword: string) {
    return await this.userAccountRepository.createNewUser(email, hashedPassword)
  }
}
