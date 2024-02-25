
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
    const user = await this.userAccountRepository.findOneByEmail(email);
    if (user && bcrypt.compare(user.password, pass)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async getOrCreateUserByDid(did: string) {
    const user = await this.userAccountRepository.findOneByDid(did);
    if (!user) {
      return await this.createDidUser(did)
    }
  }

  async login(user: any) {
    console.log(user)
    const payload = { username: user.email, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async authenticateUser(account: string, network: string) {
    const id = uuid()
    const access_token = this.jwtService.sign({
      id: id,
      type: 'singleton',
      sub: `singleton/${network}/${account}`,
      username: account,
    })

    await this.createSession(id, account);

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

  async createEmailAndPasswordUser(email: string, hashedPassword: string) {
    return await this.userAccountRepository.createNewEmailAndPasswordUser(email, hashedPassword)
  }

  async createDidUser(did: string) {
    return await this.userAccountRepository.createNewDidUser(did)
  }
}
