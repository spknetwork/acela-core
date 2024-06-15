import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UserAccountRepository } from '../../repositories/userAccount/user-account.repository';
import { v4 as uuid } from 'uuid';
import { SessionRepository } from '../../repositories/session/session.repository';
import { Network } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly userAccountRepository: UserAccountRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: JwtService,
  ) {}

  async jwtSign(payload: Record<string, string>) {
    return this.jwtService.sign(payload);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userAccountRepository.findOneByEmail(email);
    if (user && (await bcrypt.compare(user.password, pass))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async getOrCreateUserByDid(did: string) {
    const user = await this.userAccountRepository.findOneByDid(did);
    if (!user) {
      return await this.createDidUser(did);
    }
  }

  async didUserExists(did: string): Promise<boolean> {
    return Boolean(await this.userAccountRepository.findOneByDid(did));
  }

  async login(user: any) {
    console.log(user);
    const payload = { username: user.email, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  generateSub(account: string, network: Network) {
    return `singleton/${network}/${account}`;
  }

  async authenticateUser(account: string, network: Network) {
    const id = uuid();
    const access_token = this.jwtService.sign({
      id: id,
      type: 'singleton',
      sub: this.generateSub(account, network),
      username: account,
    });

    await this.createSession(id, account, network);

    return {
      access_token,
    };
  }

  async createSession(id: string, account: string, network: Network) {
    return await this.sessionRepository.insertOne({
      id,
      type: 'singleton',
      sub: this.generateSub(account, network),
    });
  }

  async getSessionByDid(id: string) {
    return await this.sessionRepository.findOneBySub(`singleton/did/${id}`);
  }

  async createEmailAndPasswordUser(email: string, hashedPassword: string) {
    return await this.userAccountRepository.createNewEmailAndPasswordUser(email, hashedPassword);
  }

  async createDidUser(did: string) {
    return await this.userAccountRepository.createNewDidUser(did);
  }
}
