import { Module } from '@nestjs/common';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { HiveService } from './hive.service';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';

@Module({
  imports: [HiveAccountModule, HiveChainModule],
  providers: [HiveService],
  exports: [HiveService],
})
export class HiveModule {}
