import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { LinkedAccount } from './schemas/linked-account.schema';
import { ObjectId } from 'mongodb';

@Injectable()
export class LinkedAccountRepository {
  constructor(
    @InjectModel(LinkedAccount.name, 'acela-core')
    private readonly linkedAccountModel: Model<LinkedAccount>,
  ) {}

  async linkHiveAccount(user_id: string, account: string) {
    return await this.linkedAccountModel.create({
      user_id,
      account,
      status: 'verified',
      network: 'HIVE',
    } satisfies LinkedAccount);
  }

  async findOneByUserIdAndAccountName(query: {
    account: LinkedAccount['account'];
    user_id: LinkedAccount['user_id'];
  }) {
    return await this.linkedAccountModel.findOne({
      ...query,
      status: 'verified',
    } satisfies Partial<LinkedAccount>);
  }

  async verify(_id: ObjectId) {
    return this.linkedAccountModel.updateOne(
      {
        _id,
      },
      {
        $set: {
          status: 'verified',
        },
      },
    );
  }

  async findAllByUserId(user_id: string) {
    return this.linkedAccountModel
      .find({ user_id, status: 'verified' }, { account: 1, _id: 0 })
      .lean()
      .exec();
  }
}
