import { Module } from '@nestjs/common';
import { PublishingModule } from '../publishing/publishing.module';
import { TasksService } from './tasks.service';
import { LockModule } from '../lock/lock.module';
import { VotingModule } from '../voting/voting.module';
import { VideoProcessModule } from '../video-process/video-process.module';

@Module({
  imports: [PublishingModule, LockModule, VotingModule, VideoProcessModule],
  providers: [TasksService],
})
export class TasksModule {}
