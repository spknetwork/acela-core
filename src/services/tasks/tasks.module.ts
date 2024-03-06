import { Module } from '@nestjs/common';
import { PublishingModule } from '../publishing/publishing.module';
import { TasksService } from './tasks.service';
import { LockModule } from '../lock/lock.module';
import { LockService } from '../lock/service/lock.service';

@Module({
  imports: [PublishingModule, LockModule],
  providers: [TasksService],
})
export class TasksModule {}
