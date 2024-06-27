import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { VideoModule } from '../../repositories/video/video.module';
import { CreatorModule } from '../../repositories/creator/creator.module';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';

@Module({
  imports: [VideoModule, CreatorModule, HiveChainModule],
  controllers: [],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}
