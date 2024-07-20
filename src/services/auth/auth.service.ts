import 'dotenv/config';
import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { LegacyUserAccountRepository } from '../../repositories/userAccount/user-account.repository';
import { v4 as uuid } from 'uuid';
import { SessionRepository } from '../../repositories/session/session.repository';
import { AccountType, Network, User } from './auth.types';
import { LegacyUserRepository } from '../../repositories/user/user.repository';
import { LegacyHiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { DID } from 'dids';
import { ObjectId } from 'mongodb';

@Injectable()
export class AuthService {
  constructor(
    private readonly legacyUserAccountRepository: LegacyUserAccountRepository,
    private readonly legacyUserRepository: LegacyUserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly legacyHiveAccountRepository: LegacyHiveAccountRepository,
    private readonly jwtService: JwtService,
  ) {}

  jwtSign(payload: User) {
    return this.jwtService.sign(payload);
  }

  async validateUser(email: string, pass: string) {
    const user = await this.legacyUserAccountRepository.findOneByEmail({ email });
    if (!user || !user.password) {
      throw new UnauthorizedException('Email or password was incorrect');
    }
    if (await bcrypt.compare(user.password, pass)) {
      const { password, ...result } = user;
      return result;
    }
    throw new UnauthorizedException('Email or password was incorrect');
  }

  async getOrCreateUserByDid(did: string): Promise<{ sub?: string; user_id: string }> {
    const user = await this.legacyUserRepository.findOneBySub(this.generateDidSub(did));
    if (user) {
      return { user_id: user.user_id, sub: user.sub };
    }
    const user_id = uuid();
    const didUser = await this.createDidUser(did, user_id);
    return { sub: didUser.sub, user_id };
  }

  async getOrCreateUserByHiveUsername(
    username: string,
  ): Promise<{ sub?: string; user_id: string }> {
    const user = await this.legacyUserRepository.findOneBySub(this.generateHiveSub(username));
    if (user) {
      return { user_id: user.user_id, sub: user.sub };
    }
    const user_id = uuid();
    const didUser = await this.createHiveUser({ user_id, hiveAccount: username });
    return { sub: didUser.sub, user_id };
  }

  async didUserExists(did: string): Promise<boolean> {
    return !!(await this.legacyUserRepository.findOneBySub(this.generateDidSub(did)));
  }

  async login(user: User) {
    return {
      access_token: this.jwtSign(user),
    };
  }

  async getUserByUserId({ user_id }: { user_id: string }) {
    return this.legacyUserRepository.findOneByUserId({ user_id });
  }

  generateSub(accountType: AccountType, account: string, network: Network) {
    return `${accountType}/${account}/${network}`;
  }

  generateDidSub(did: string) {
    return this.generateSub('singleton', did, 'did');
  }

  generateHiveSub(username: string) {
    return this.generateSub('singleton', username, 'hive');
  }

  async authenticateUser(type: AccountType, account: string, network: Network) {
    const sub = this.generateSub(type, account, network);

    const user = await this.legacyUserRepository.findOneBySub(sub);

    if (!user) throw new UnauthorizedException('Could not find requested user');

    const access_token = this.jwtSign({
      user_id: user.user_id,
      type,
      sub,
      network,
    });

    await this.createSession(type, user.user_id, account, network);

    return {
      access_token,
    };
  }

  async authenticateUserByDid(did: string) {
    return this.authenticateUser('singleton', did, 'did');
  }

  async createSession(type: AccountType, id: string, account: string, network: Network) {
    return await this.sessionRepository.insertOne({
      id,
      type,
      sub: this.generateSub(type, account, network),
    });
  }

  async getSessionByDid(did: string) {
    return await this.sessionRepository.findOneBySub(this.generateDidSub(did));
  }

  async createEmailAndPasswordUser(
    email: string,
    password: string,
    user_id: string,
  ): Promise<string> {
    await this.legacyUserRepository.createNewEmailUser({ email, user_id });
    return await this.legacyUserAccountRepository.createNewEmailAndPasswordUser({
      email,
      password,
      username: user_id,
    });
  }

  async createHiveUser({ user_id, hiveAccount }: { user_id: string; hiveAccount: string }) {
    const sub = this.generateHiveSub(hiveAccount);
    const account = await this.legacyUserRepository.createNewSubUser({
      sub,
      user_id,
    });
    await this.legacyUserAccountRepository.createOne({
      sub,
      hiveAccount,
      username: user_id,
    });
    await this.linkHiveAccount({
      username: hiveAccount,
      user_id: account._id,
    });
    return account;
  }

  async linkHiveAccount({ user_id, username }: { user_id: ObjectId; username: string }) {
    await this.legacyHiveAccountRepository.insertCreated({
      account: username,
      user_id,
    });
  }

  async unlinkHiveAccount({ user_id, username }: { user_id: ObjectId; username: string }) {
    await this.legacyHiveAccountRepository.deleteOne({
      account: username,
      user_id,
    });
  }

  async createDidUser(did: string, user_id: string) {
    const sub = this.generateDidSub(did);
    const account = await this.legacyUserRepository.createNewSubUser({
      sub,
      user_id,
    });
    await this.legacyUserAccountRepository.createOne({
      sub,
      hiveAccount: null,
      username: user_id,
    });
    return account;
  }

  async verifyEmail(confirmationCode: string): Promise<boolean> {
    return this.legacyUserAccountRepository.verifyEmail({ confirmationCode });
  }
}
