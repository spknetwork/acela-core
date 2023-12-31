import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksModule } from './services/tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VideoModule } from './repositories/video/video.module';
import { ConfigModule } from '@nestjs/config';
import { PublishingModule } from './services/publishing/publishing.module';
import { CreatorModule } from './repositories/creator/creator.module';
import { UserModule } from './repositories/user/user.module';

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
    UserModule,
    PublishingModule,
    TasksModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
