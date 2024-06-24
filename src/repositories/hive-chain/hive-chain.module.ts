import { Module } from '@nestjs/common';
import { HiveChainRepository } from './hive-chain.repository';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockHiveRepository } from './hive-chain.repository.mock';
import { MockFactory } from '../../factories/mock.factory';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [
    {
      provide: HiveChainRepository,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        MockFactory<HiveChainRepository, undefined>(
          HiveChainRepository,
          MockHiveRepository,
          configService,
          'local',
        ),
    },
  ],
  exports: [HiveChainRepository],
})
export class HiveChainModule {}
