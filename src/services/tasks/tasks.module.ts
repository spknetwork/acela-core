import { Module } from '@nestjs/common';
import { PublishingModule } from '../publishing/publishing.module';
import { TasksService } from './tasks.service';
import { LockModule } from '../lock/lock.module';
import { VotingModule } from '../voting/voting.module';

@Module({
  imports: [PublishingModule, LockModule, VotingModule],
  providers: [TasksService],
})
export class TasksModule {}
