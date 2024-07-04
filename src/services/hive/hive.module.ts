import { Module } from '@nestjs/common';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { HiveService } from './hive.service';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { LinkedAccountModule } from '../../repositories/linked-accounts/linked-account.module';

@Module({
  imports: [HiveAccountModule, HiveChainModule, LinkedAccountModule],
  providers: [HiveService],
  exports: [HiveService],
})
export class HiveModule {}
