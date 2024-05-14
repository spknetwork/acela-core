import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { VideoRepository } from './video.repository';
import { Video, VideoDocument, VideoSchema } from './schemas/video.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockVideoRepository } from './video.repository.mock';
import { Model } from 'mongoose';
import { MockFactory } from '../../factories/mock.factory';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }], 'threespeak'),
    ConfigModule,
  ],
  controllers: [],
  providers: [
    {
      provide: VideoRepository, 
      inject: [ConfigService, getModelToken(Video.name, 'threespeak')],
      useFactory: (configService: ConfigService, videoModel: Model<Video>) => 
        MockFactory<VideoRepository, Model<Video>>(VideoRepository, MockVideoRepository, configService, videoModel),
    },
  ],
  exports: [VideoRepository]
})
export class VideoModule {}