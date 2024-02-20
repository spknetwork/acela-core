import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserAccount } from './schemas/user-account.schema';
import { ulid } from 'ulid';
import { CreateUserAccountDto } from './dto/user-account.dto';

@Injectable()
export class UserAccountRepository {
  readonly #logger = new Logger(UserAccountRepository.name);

  constructor(@InjectModel(UserAccount.name, '3speakAuth') private userAccountModel: Model<UserAccount>) {}
    
  async findOne(email: string): Promise<UserAccount | undefined> {
    const query = { email };
    const authUser = await this.userAccountModel.findOne(query);
    this.#logger.log(authUser) // TODO: delete - not suitable for prod

    return authUser;
  }

  async createNewUser(email: string, hashedPassword: string): Promise<CreateUserAccountDto> {
    return this.userAccountModel.create({
      email,
      email_code: ulid(),
      auth_methods: {
        password: {
          value: hashedPassword
        }
      }
    });
  }
}