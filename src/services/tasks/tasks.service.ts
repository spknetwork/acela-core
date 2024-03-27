import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublishingService } from '../publishing/publishing.service';
import { LockService } from '../lock/service/lock.service';
import { VotingService } from '../voting/voting.service';

@Injectable()
export class TasksService {
  readonly #publishingService: PublishingService;
  readonly #logger: Logger;
  readonly #lockService: LockService;
  readonly #votingService: VotingService;

  constructor(
    publishingService: PublishingService,
    lockService: LockService,
    votingSevice: VotingService
  ) {
    this.#publishingService = publishingService;
    this.#lockService = lockService;
    this.#votingService = votingSevice;
    this.#logger = new Logger(TasksService.name);
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'Publish mongo videos to hive chain' })
  async publishVideosToHive() {
      await this.#lockService.executeWithLock('publishVideosToHive', async () => {
          await this.#publishingService.normalVideoPublish();
      });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'Reward videos with votes' })
  async distributeVotes() {
    await this.#lockService.executeWithLock('distributeVotes', async () => {
      await this.#votingService.distributeVotes(6)
    })
  }
}