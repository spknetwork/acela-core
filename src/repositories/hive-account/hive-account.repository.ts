import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HiveAccount } from './schemas/hive-account.schema';

@Injectable()
export class HiveAccountRepository {
  readonly #logger = new Logger(HiveAccountRepository.name);

  constructor(
    @InjectModel(HiveAccount.name, 'threespeak') private hiveAccountModel: Model<HiveAccount>,
  ) {}

  async findOneByOwner(created_by: string): Promise<HiveAccount | null> {
    const acelaUser = await this.hiveAccountModel.findOne({ created_by });
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

  async insertCreated(username: string, created_by) {
    return await this.hiveAccountModel.create({
      status: 'created',
      username,
      keys_requested: false,
      created_by,
      requested_at: new Date(),
      created_at: new Date(),
    });
  }
}
