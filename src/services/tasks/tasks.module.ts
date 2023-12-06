import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { VideoModule } from '../video/video.module';

@Module({
  imports: [VideoModule],
  providers: [TasksService],
})
export class TasksModule {}
