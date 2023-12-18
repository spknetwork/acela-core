import { Injectable } from "@nestjs/common";
import { PublishingService } from "./publishing.service";
import { CreatorRepository } from "../../repositories/creator/creator.service";
import { OperationsArray } from "./types";
import { VideoRepository } from "../../repositories/video/video.service";

@Injectable()
export class MockPublishingService extends PublishingService {

  constructor(videoService: VideoRepository, creatorService: CreatorRepository) {
    super(videoService, creatorService);
  }

  async _broadcastOperations(operations: OperationsArray) {
    this.getLogger().log('Mocking broadcastOperations');

    // List of potential error messages.
    const errorMessages = [
      'power up',
      'maximum_block_size',
      'Missing Posting Authority',
      'Title size limit exceeded.',
      'Updating parameters for comment that is paid out is forbidden',
      'Comment already has beneficiaries specified'
    ];

    // Randomly decide whether to return success or an error message.
    if (Math.random() > 0.5) {
      return { id: 'yup' };
    } else {
      // Simulate an error by randomly selecting a message from the errorMessages array.
      const errorMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      return { message: errorMessage };
    }
  }
}
