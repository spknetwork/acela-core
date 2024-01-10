import { Injectable, Logger } from "@nestjs/common";
import { HiveRepository } from "./hive.repository";
import { OperationsArray } from "./types";

@Injectable()
export class MockHiveRepository extends HiveRepository {
  readonly #logger: Logger = new Logger(MockHiveRepository.name);

  constructor() {
    super();
  }

  async broadcastOperations(operations: OperationsArray) {
    this.#logger.log('Mocking broadcastOperations');

    if (!operations) {
      throw new Error('No operations suppplied')
    }

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