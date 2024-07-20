import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HiveChainRepository } from './hive-chain.repository';
import { HiveChainConfigService } from './hive-chain.config.service';
import { MockFactory } from '../../factories/mock.factory';
import { MockHiveChainRepository } from './hive-chain.repository.mock';
import { Client } from '@hiveio/dhive';

@Module({
  imports: [ConfigModule],
  providers: [
    HiveChainConfigService,
    {
      provide: Client,
      useFactory: (hiveChainConfigService: HiveChainConfigService) => {
        return hiveChainConfigService.createHiveClient();
      },
      inject: [HiveChainConfigService],
    },
    {
      provide: HiveChainRepository,
      inject: [Client, ConfigService],
      useFactory: (hiveClient: Client, configService: ConfigService) => {
        return MockFactory<HiveChainRepository, Client>(
          HiveChainRepository,
          MockHiveChainRepository,
          {
            configService,
            model: hiveClient,
            mockTilStage: 'local',
          },
        );
      },
    },
  ],
  exports: [HiveChainRepository, Client],
})
export class HiveChainModule {}
