import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { VideoModule } from '../repositories/video/video.module';
import { CreatorModule } from '../repositories/creator/creator.module';
import { MockPublishingService } from './publishing.service.mock';
import { VideoService } from '../repositories/video/video.service';
import { CreatorService } from '../repositories/creator/creator.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [VideoModule, CreatorModule, ConfigModule],
  controllers: [],
  providers: [
    {
      provide: PublishingService,
      inject: [VideoService, CreatorService, ConfigService],
      useFactory: (videoService: VideoService, creatorService: CreatorService, configService: ConfigService) => {
        const env = configService.get<string>('ENVIRONMENT');
        if (env !== 'prod') {
          return new MockPublishingService(videoService, creatorService);
        } else {
          return new PublishingService(videoService, creatorService);
        }
      },
    },
  ],
  exports: [PublishingService]
})
export class PublishingModule {}