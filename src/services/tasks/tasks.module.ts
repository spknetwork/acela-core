import { Module } from '@nestjs/common';
import { PublishingModule } from '../publishing/publishing.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [PublishingModule],
  providers: [TasksService],
})
export class TasksModule {}
