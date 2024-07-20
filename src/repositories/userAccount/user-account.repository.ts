import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LegacyUserAccount } from './schemas/user-account.schema';
import bcrypt from 'bcryptjs';

interface CreateUserParams {
  email: string;
  password: string;
  username: string;
}

@Injectable()
export class LegacyUserAccountRepository {
  readonly #logger = new Logger(LegacyUserAccountRepository.name);

  constructor(
    @InjectModel('useraccounts', '3speakAuth')
    private legacyUserAccountModel: Model<LegacyUserAccount>,
  ) {}

  async findOneByEmail(query: Pick<LegacyUserAccount, 'email'>): Promise<LegacyUserAccount | null> {
    const authUser = await this.legacyUserAccountModel.findOne(query);
    this.#logger.log(authUser); // TODO: delete - not suitable for prod

    return authUser;
  }

  async verifyEmail(query: Pick<LegacyUserAccount, 'confirmationCode'>): Promise<boolean> {
    const result = await this.legacyUserAccountModel.updateOne(query, {
      $set: { emailVerified: true },
    });
    return result.modifiedCount > 0;
  }

  async createNewEmailAndPasswordUser(query: CreateUserParams): Promise<string> {
    query.password = bcrypt.hashSync(query.password, bcrypt.genSaltSync(10));
    const { confirmationCode } = await this.legacyUserAccountModel.create(query);

    if (!confirmationCode)
      throw new InternalServerErrorException(
        'Please alert the team email code was missing after email account creation',
      );

    return confirmationCode;
  }

  async createOne({
    sub,
    hiveAccount,
    password,
    email,
    username,
  }: {
    sub: string;
    hiveAccount: string | null;
    password?: string;
    email?: string;
    username: string;
  }) {
    if ((email && !password) || (!email && password)) {
      throw new Error('Both email and password must be provided or not provided at all.');
    }

    const userAccount = { sub, hiveAccount, password, email, username } satisfies LegacyUserAccount;
    return (await this.legacyUserAccountModel.create(userAccount)).toObject();
  }
}
