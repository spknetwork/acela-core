import { Injectable, Logger } from "@nestjs/common";
import { VideoService } from "./video.service";
import { Video } from "./schemas/video.schema";
import { Model } from "mongoose";
import { ObjectId } from "mongodb";

@Injectable()
export class MockVideoService extends VideoService {
  readonly #logger: Logger;

  constructor(videoModel: Model<Video>) {
    super(videoModel);

    this.#logger = new Logger(MockVideoService.name)
  }

  async updateVideoFailureStatus(owner: string, failureStatuses: { lowRc: boolean; publishFailed: boolean; }) {
    this.#logger.log(owner, failureStatuses,'update failure status mock');
    return Promise.resolve({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: new ObjectId(1)
    });
  }

  async setPostedToChain(owner: string, ipfs?: string) {
    this.#logger.log(owner, 'set posted to chain mock');
    return Promise.resolve({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: new ObjectId(1)
    });
  }
}