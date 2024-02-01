import { Module } from '@nestjs/common';
import { UploadingController } from './uploading.controller';
import { UploadModule } from '../../repositories/upload/upload.module';
import { VideoModule } from '../../repositories/video/video.module';
import { UploadingService } from './uploading.service';
import { IpfsModule } from '../ipfs/ipfs.module';

@Module({
  imports: [ UploadModule, VideoModule, IpfsModule ],
  controllers: [ UploadingController ],
  providers: [ UploadingService ],
  exports: [ UploadingService ]
})
export class UploadingModule {}