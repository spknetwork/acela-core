import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HiveAccount, HiveAccountSchema } from './schemas/hive-account.schema';
import { HiveAccountRepository } from './hive-account.repository';
import { Model } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HiveAccount.name, schema: HiveAccountSchema }], 'threespeak'),
  ],
  controllers: [],
  providers: [HiveAccountRepository],
  exports: [HiveAccountRepository]
})
export class HiveAccountModule {}