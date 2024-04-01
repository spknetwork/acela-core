import { Module } from '@nestjs/common';
import { VideoProcessService } from './video.process.service';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from '../../repositories/upload/upload.module';

@Module({
  imports: [UploadModule, ConfigModule],
  controllers: [],
  providers: [VideoProcessService],
  exports: [VideoProcessService]
})
export class VideoProcessModule {}