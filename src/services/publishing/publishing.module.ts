import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { VideoModule } from '../../repositories/video/video.module';
import { CreatorModule } from '../../repositories/creator/creator.module';
import { MockPublishingService } from './publishing.service.mock';
import { VideoRepository } from '../../repositories/video/video.repository';
import { CreatorRepository } from '../../repositories/creator/creator.repository';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [VideoModule, CreatorModule, ConfigModule],
  controllers: [],
  providers: [
    {
      provide: PublishingService,
      inject: [VideoRepository, CreatorRepository, ConfigService],
      useFactory: (videoService: VideoRepository, creatorService: CreatorRepository, configService: ConfigService) => {
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