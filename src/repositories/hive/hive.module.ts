import { Module } from '@nestjs/common';
import { HiveRepository as HiveRepository } from './hive.repository';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockHiveRepository } from './hive.repository.mock';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [],
  providers: [
    {
      provide: HiveRepository,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<string>('ENVIRONMENT');
        // if (env !== 'prod') {
        //   return new MockHiveRepository;
        // } else {
          return new HiveRepository;
        // }
      },
    },
  ],
  exports: [HiveRepository]
})
export class HiveModule {}