import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UserRepository {
  readonly #logger = new Logger(UserRepository.name);

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
    
  async findOne(username: string): Promise<User | undefined> {
    const query = { email: username };
    const acelaUser = await this.userModel.findOne(query);
    this.#logger.log(acelaUser)

    return acelaUser;
  }
}
