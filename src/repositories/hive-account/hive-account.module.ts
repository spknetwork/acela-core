import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LegacyHiveAccountSchema } from './schemas/hive-account.schema';
import { LegacyHiveAccountRepository } from './hive-account.repository';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'hiveaccounts', schema: LegacyHiveAccountSchema }],
      'threespeak',
    ),
  ],
  controllers: [],
  providers: [LegacyHiveAccountRepository],
  exports: [LegacyHiveAccountRepository],
})
export class HiveAccountModule {}
