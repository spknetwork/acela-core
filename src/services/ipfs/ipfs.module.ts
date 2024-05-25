import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { MockFactory } from '../../factories/mock.factory';
import { MockIpfsService } from './ipfs.service.mock';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IpfsService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        MockFactory(IpfsService, MockIpfsService, configService, 'local'),
    },
  ],
  exports: [IpfsService],
})
export class IpfsModule {}
