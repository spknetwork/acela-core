import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VideoService } from '../video/video.service';
import { chunk } from '../../utils/chunk';
import hive from '@hiveio/hive-js';

@Injectable()
export class TasksService {
  readonly #logger = new Logger(TasksService.name);
  readonly #videoService: VideoService;

  constructor(videoService: VideoService) {
    this.#videoService = videoService;
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'Post trending data to chain' })
  async updateTrendingDataOnChain() {
    const trendingForChain = await this.#videoService.getTrendingForChain()
    const chunks = chunk(trendingForChain, 10)
    const operations = chunks.map((chunk, index) => ([
      'custom_json', {
          required_posting_auths: [process.env.DELEGATED_ACCOUNT],
          required_auths: [],
          id: `3speak-trending-${index}`,
          json: JSON.stringify(chunk)
      }
    ]));
    try {
      const tx = await hive.broadcast.sendAsync({
        operations: operations
      }, {
        posting: process.env.DELEGATED_ACCOUNT_POSTING
      });
      this.#logger.log(`DONE: https://hiveblockexplorer.com/tx/${tx.id}`)
    } catch (e) {
      console.log(e.message)
    }
  }
}