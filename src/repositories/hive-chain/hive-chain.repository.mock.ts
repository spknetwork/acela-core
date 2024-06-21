import { Injectable, Logger } from '@nestjs/common';
import { HiveRepository } from './hive-chain.repository';
import { OperationsArray } from './types';
import { TransactionConfirmation } from '@hiveio/dhive';

@Injectable()
export class MockHiveRepository extends HiveRepository {
  readonly #logger: Logger = new Logger(MockHiveRepository.name);

  constructor() {
    super();
  }

  async broadcastOperations(operations: OperationsArray) {
    this.#logger.log('Mocking broadcastOperations');

    if (!operations) {
      throw new Error('No operations suppplied');
    }

    // List of potential error messages.
    const errorMessages = [
      'power up',
      'maximum_block_size',
      'Missing Posting Authority',
      'Title size limit exceeded.',
      'Updating parameters for comment that is paid out is forbidden',
      'Comment already has beneficiaries specified',
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

  async vote(options: {
    author: string;
    permlink: string;
    voter: string;
    weight: number;
  }): Promise<TransactionConfirmation> {
    if (options.weight < 0 || options.weight > 10_000) {
      this.#logger.error(
        `Vote weight was out of bounds: ${options.weight}. Skipping ${options.author}/${options.permlink}`,
      );
      throw new Error('Vote attempted with an invalid weight');
    }
    this.#logger.log('Voting:', options);

    return Promise.resolve({
      id: 'mock_id',
      block_num: 123456,
      trx_num: 789,
      expired: false,
    });
  }

  async comment(
    author: string,
    content: string,
    comment_options: { parent_author: string; parent_permlink: string },
  ) {
    this.#logger.log(
      `${author} is commenting ${content} on ${comment_options.parent_author}/${comment_options.parent_permlink}`,
    );
    return {
      id: 'test',
      block_num: 1,
      trx_num: 8008135,
      expired: false,
    };
  }

  async getAccount(author: string) {
    const [hiveAccount] = await this._hive.database.getAccounts([author]);
    if (process.env.TEST_PUBLIC_KEY)
      hiveAccount.posting.key_auths.push([process.env.TEST_PUBLIC_KEY, 1]);
    return hiveAccount;
  }
}
