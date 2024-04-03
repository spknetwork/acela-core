import { Module } from '@nestjs/common';
import { HiveRepository as HiveRepository } from './hive.repository';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockHiveRepository } from './hive.repository.mock';
import { MockFactory } from '../../factories/mock.factory';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [],
  providers: [
    {
      provide: HiveRepository,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => MockFactory<HiveRepository, undefined>(HiveRepository, MockHiveRepository, configService),
    },
  ],
  exports: [HiveRepository]
})
export class HiveModule {}