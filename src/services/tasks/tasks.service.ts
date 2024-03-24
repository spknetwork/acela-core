import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublishingService } from '../publishing/publishing.service';
import { LockService } from '../lock/service/lock.service';

@Injectable()
export class TasksService {
  readonly #publishingService: PublishingService;
  readonly #logger: Logger;
  readonly #lockService: LockService;

  constructor(
    publishingService: PublishingService,
    lockService: LockService
  ) {
    this.#publishingService = publishingService;
    this.#lockService = lockService;
    this.#logger = new Logger(TasksService.name)
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'Publish mongo videos to hive chain' })
  async publishVideosToHive() {
      await this.#lockService.executeWithLock('publishVideosToHive', async () => {
          await this.#publishingService.normalVideoPublish();
      });
  }

  async onModuleInit(): Promise<void> {
    // Attempt to register this service instance with the lock service
    try {
      await this.#lockService.registerLock(TasksService.name);
      this.#logger.log('Successfully registered with the lock service.');
    } catch (error) {
      this.#logger.error('Failed to register with the lock service.', error);
    }
  }
}