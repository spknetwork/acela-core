import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { VideoModule } from '../../repositories/video/video.module';
import { CreatorModule } from '../../repositories/creator/creator.module';
import { HiveModule } from '../../repositories/hive/hive.module';

@Module({
  imports: [VideoModule, CreatorModule, HiveModule],
  controllers: [],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}
