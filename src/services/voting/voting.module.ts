import { Module } from '@nestjs/common';
import { VotingService } from './voting.service';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { VideoModule } from '../../repositories/video/video.module';
import { CreatorModule } from '../../repositories/creator/creator.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HiveChainModule, VideoModule, CreatorModule, ConfigModule],
  controllers: [],
  providers: [VotingService],
  exports: [VotingService],
})
export class VotingModule {}
