import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksModule } from './services/tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VideoModule } from './services/video/video.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.CORE_MONGODB_URL),
    ScheduleModule.forRoot(),
    VideoModule,
    TasksModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
