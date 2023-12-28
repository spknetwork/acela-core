import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { PublishingService } from '../publishing/publishing.service';

@Injectable()
export class TasksService {
  readonly #publishingService: PublishingService;
  readonly #logger: Logger;

  constructor(publishingService: PublishingService) {
    this.#publishingService = publishingService;
    this.#logger = new Logger(PublishingService.name)
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'Publish mongo videos to hive chain' })
  async publishVideosToHive() {
    try {
      await this.#publishingService.normalVideoPublish();
    } catch (error) {
      this.#logger.error("Failed to publish videos to Hive", error);
    }
  }
}