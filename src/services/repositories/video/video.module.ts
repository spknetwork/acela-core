import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { VideoService } from './video.service';
import { Video, VideoDocument, VideoSchema } from './schemas/video.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockVideoService } from './video.service.mock';
import { Model } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    ConfigModule,
  ],
  controllers: [],
  providers: [
    {
      provide: VideoService,
      inject: [ConfigService, getModelToken(Video.name)],
      useFactory: (configService: ConfigService, videoModel: Model<VideoDocument>) => {
        const env = configService.get<string>('ENVIRONMENT');
        if (env !== 'prod') {
          return new MockVideoService(videoModel);
        } else {
          return new VideoService(videoModel);
        }
      },
    },
  ],
  exports: [VideoService]
})
export class VideoModule {}