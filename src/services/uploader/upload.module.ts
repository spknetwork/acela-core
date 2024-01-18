import { Module } from '@nestjs/common';
import { UploaderController } from './upload.controller';
import { UploadModule } from '../../repositories/upload/upload.module';
import { VideoModule } from '../../repositories/video/video.module';
import { UploadingService } from './upload.service';

@Module({
  imports: [ UploadModule, VideoModule ],
  controllers: [ UploaderController ],
  providers: [ UploadingService ],
  exports: [ UploadingService ]
})
export class UploaderModule {}