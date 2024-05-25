import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoRepository } from './video.repository';
import { Video, VideoSchema } from './schemas/video.schema';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }], 'threespeak'),
    ConfigModule,
  ],
  controllers: [],
  providers: [VideoRepository],
  exports: [VideoRepository]
})
export class VideoModule {}