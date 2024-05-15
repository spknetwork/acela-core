import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserAccount, UserAccountSchema } from './schemas/user-account.schema';
import { UserAccountRepository } from './user-account.repository';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: UserAccount.name, schema: UserAccountSchema }],
      '3speakAuth',
    ),
  ],
  providers: [UserAccountRepository],
  exports: [UserAccountRepository],
})
export class UserAccountModule {}
