import 'dotenv/config';
import { Module } from '@nestjs/common';
import { UploadingController } from './uploading.controller';
import { UploadModule } from '../../repositories/upload/upload.module';
import { VideoModule } from '../../repositories/video/video.module';
import { UploadingService } from './uploading.service';
import { IpfsModule } from '../ipfs/ipfs.module';
import { PublishingModule } from '../publishing/publishing.module';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { JwtModule } from '@nestjs/jwt';
import { RequireHiveVerify, UserDetailsInterceptor } from '../api/utils';

@Module({
  imports: [
    UploadModule,
    VideoModule,
    IpfsModule,
    PublishingModule,
    HiveChainModule,
    JwtModule.register({
      privateKey: process.env.JWT_PRIVATE_KEY,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [UploadingController],
  providers: [UploadingService, UserDetailsInterceptor, RequireHiveVerify],
  exports: [UploadingService],
})
export class UploadingModule {}
