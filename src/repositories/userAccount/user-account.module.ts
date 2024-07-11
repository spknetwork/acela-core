import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LegacyUserAccountSchema } from './schemas/user-account.schema';
import { LegacyUserAccountRepository } from './user-account.repository';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'useraccounts', schema: LegacyUserAccountSchema }],
      '3speakAuth',
    ),
  ],
  providers: [LegacyUserAccountRepository],
  exports: [LegacyUserAccountRepository],
})
export class UserAccountModule {}
