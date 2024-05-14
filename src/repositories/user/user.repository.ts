import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { ulid } from 'ulid';

@Injectable()
export class UserRepository {
  readonly #logger = new Logger(UserRepository.name);

  constructor(@InjectModel(User.name, 'threespeak') private userModel: Model<User>) {}
    
  // async findOneByUsername(username: string): Promise<User | undefined> {
  //   const query = { username };
  //   const acelaUser = await this.userModel.findOne(query);
  //   this.#logger.log(acelaUser)

  //   return acelaUser;
  // }

  async findOneByEmail(email: string): Promise<User | null> {
    const query = { email };
    const acelaUser = await this.userModel.findOne(query);
    this.#logger.log(acelaUser)

    return acelaUser;
  }

  // async insertOne() {
  //   this.userModel.create<User>({})
  // }

  async verifyEmail(verifyCode: string) {
    this.userModel.updateOne(
      {
        email_code: verifyCode,
      },
      {
        $set: {
          email_status: 'verified',
        },
      },
    )
  }
}
