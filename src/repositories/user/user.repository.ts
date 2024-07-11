import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LegacyUser } from './schemas/user.schema';
import { ObjectId } from 'mongodb';

@Injectable()
export class LegacyUserRepository {
  readonly #logger = new Logger(LegacyUserRepository.name);

  constructor(@InjectModel('users', 'threespeak') private userModel: Model<LegacyUser>) {}

  // async findOneByUsername(username: string): Promise<User | undefined> {
  //   const query = { username };
  //   const acelaUser = await this.userModel.findOne(query);
  //   this.#logger.log(acelaUser)

  //   return acelaUser;
  // }

  async findOneByEmail(email: string): Promise<LegacyUser | null> {
    const query = { email };
    const acelaUser = await this.userModel.findOne(query);
    this.#logger.log(acelaUser);

    return acelaUser;
  }

  async findOneBySub(sub: string) {
    const query = { sub } satisfies Partial<LegacyUser>;
    const authUser = await this.userModel.findOne(query);

    return authUser ? authUser.toObject() : null;
  }

  async findOneByUserId(query: Pick<LegacyUser, 'user_id'>) {
    const authUser = await this.userModel.findOne(query);

    return authUser ? authUser.toObject() : null;
  }

  // async insertOne() {
  //   this.userModel.create<User>({})
  // }

  async createNewEmailUser(query: Pick<LegacyUser, 'email' | 'user_id'>) {
    await this.userModel.create(query);
  }

  async createNewSubUser(user: Pick<LegacyUser, 'sub' | 'user_id'>) {
    return await this.userModel.create(user);
  }

  async getLegacyLinkedHiveAccounts(user_id: string): Promise<{
    banned: boolean;
    linked_hiveaccounts: string[];
    user_id: string;
    last_hiveaccount: string;
    _id: ObjectId;
  }> {
    return (
      await this.userModel
        .aggregate<{
          banned: boolean;
          linked_hiveaccounts: string[];
          user_id: string;
          last_hiveaccount: string;
          _id: ObjectId;
        }>([
          {
            $match: { user_id },
          },
          {
            $lookup: {
              from: 'hiveaccounts',
              localField: '_id',
              foreignField: 'user_id',
              as: 'linked_hiveaccounts',
            },
          },
          {
            $lookup: {
              from: 'hiveaccounts',
              localField: 'last_identity',
              foreignField: '_id',
              as: 'last_hiveaccount',
            },
          },
          {
            $unwind: {
              path: '$linked_hiveaccounts',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $unwind: {
              path: '$last_hiveaccount',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $group: {
              _id: '$_id',
              email: { $first: '$email' },
              user_id: { $first: '$user_id' },
              banned: { $first: '$banned' },
              linked_hiveaccounts: { $push: '$linked_hiveaccounts.account' },
              last_hiveaccount: { $first: '$last_hiveaccount.account' },
            },
          },
          {
            $project: {
              email: 1,
              linked_hiveaccounts: 1,
              user_id: 1,
              last_hiveaccount: 1,
              banned: 1,
              _id: 1,
            },
          },
        ])
        .exec()
    )[0];
  }
}
