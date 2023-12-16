import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksModule } from './services/tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VideoModule } from './services/repositories/video/video.module';
import { ConfigModule } from '@nestjs/config';
import { PublishingModule } from './services/publishing/publishing.module';
import { CreatorModule } from './services/repositories/creator/creator.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017', {
      autoIndex: true,
    }),
    ScheduleModule.forRoot(),
    VideoModule,
    CreatorModule,
    PublishingModule,
    TasksModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
