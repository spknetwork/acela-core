import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublishingService } from '../publishing/publishing.service';
import { LockService } from '../lock/service/lock.service';
import { VotingService } from '../voting/voting.service';
import { VideoProcessService } from '../video-process/video.process.service';

@Injectable()
export class TasksService {
  readonly #publishingService: PublishingService;
  readonly #lockService: LockService;
  readonly #votingService: VotingService;
  readonly #videoProcessService: VideoProcessService;

  constructor(
    publishingService: PublishingService,
    lockService: LockService,
    votingSevice: VotingService,
    videoProcessService: VideoProcessService,
  ) {
    this.#publishingService = publishingService;
    this.#lockService = lockService;
    this.#votingService = votingSevice;
    this.#videoProcessService = videoProcessService;
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'Publish mongo videos to hive chain' })
  async publishVideosToHive() {
    await this.#lockService.executeWithLock('publishVideosToHive', async () => {
      await this.#publishingService.normalVideoPublish();
    });
  }

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'Reward videos with votes' })
  async distributeVotes() {
    await this.#lockService.executeWithLock('distributeVotes', async () => {
      await this.#votingService.distributeVotes(6);
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'Check encoding' })
  async checkEncoding() {
    await this.#lockService.executeWithLock('checkEncoding', async () => {
      await this.#videoProcessService.checkEncoding();
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'Queue encoding' })
  async queueEncoding() {
    await this.#lockService.executeWithLock('checkEncoding', async () => {
      await this.#videoProcessService.queueEncoding();
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'Queue IPFS' })
  async queueIpfs() {
    await this.#lockService.executeWithLock('queueIpfs', async () => {
      await this.#videoProcessService.queueIpfs();
    });
  }
}
