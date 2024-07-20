import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LegacyHiveAccount } from './schemas/hive-account.schema';

@Injectable()
export class LegacyHiveAccountRepository {
  readonly #logger = new Logger(LegacyHiveAccountRepository.name);

  constructor(
    @InjectModel('hiveaccounts', 'threespeak') private hiveAccountModel: Model<LegacyHiveAccount>,
  ) {}

  async findOneByOwnerIdAndHiveAccountName(
    query: Pick<LegacyHiveAccount, 'user_id' | 'account'>,
  ): Promise<LegacyHiveAccount | null> {
    const acelaUser = await this.hiveAccountModel.findOne(query);
    this.#logger.log(acelaUser);

    return acelaUser;
  }

  async findOneByOwnerId(
    query: Pick<LegacyHiveAccount, 'user_id'>,
  ): Promise<LegacyHiveAccount | null> {
    const acelaUser = await this.hiveAccountModel.findOne(query);
    this.#logger.log(acelaUser);

    return acelaUser;
  }

  async createLite(username: string, secret: string) {
    return await this.hiveAccountModel.create({
      status: 'requested',
      username,
      keys_requested: false,
      created_by: null,
      requested_at: new Date(),
      request_type: 'otp-login',
      created_at: new Date(),
      secret,
    });
  }

  async deleteOne(query: Pick<LegacyHiveAccount, 'user_id' | 'account'>) {
    return this.hiveAccountModel.deleteOne(query);
  }

  async insertCreated(query: Pick<LegacyHiveAccount, 'user_id' | 'account'>) {
    return await this.hiveAccountModel.create(query);
  }
}
