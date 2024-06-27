import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HiveAccount } from './schemas/hive-account.schema';
import { ObjectId } from 'mongodb';

@Injectable()
export class HiveAccountRepository {
  readonly #logger = new Logger(HiveAccountRepository.name);

  constructor(
    @InjectModel(HiveAccount.name, 'threespeak') private hiveAccountModel: Model<HiveAccount>,
  ) {}

  async findOneByOwnerIdAndHiveAccountName({
    user_id,
    account,
  }: {
    user_id: string | ObjectId;
    account: string;
  }): Promise<HiveAccount | null> {
    const acelaUser = await this.hiveAccountModel.findOne({ user_id, account });
    this.#logger.log(acelaUser);

    return acelaUser;
  }

  async findOneByOwnerId({ user_id }: { user_id: string | ObjectId }): Promise<HiveAccount | null> {
    const acelaUser = await this.hiveAccountModel.findOne({ user_id });
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

  async insertCreated(username: string, created_by: string) {
    return await this.hiveAccountModel.create({
      account: username,
      user_id: created_by,
    });
  }
}
