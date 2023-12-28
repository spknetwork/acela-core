import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { PublishingService } from '../publishing/publishing.service';

@Injectable()
export class TasksService {
  readonly #publishingService: PublishingService;

  constructor(publishingService: PublishingService) {
    this.#publishingService = publishingService;
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'Publish mongo videos to hive chain' })
  async publishVideosToHive() {
    this.#publishingService.normalVideoPublish();
  }
}