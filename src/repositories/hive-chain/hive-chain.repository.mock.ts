import { Injectable, Logger } from '@nestjs/common';
import { HiveChainRepository } from './hive-chain.repository';
import { OperationsArray } from './types';
import { Operation, TransactionConfirmation } from '@hiveio/dhive';

@Injectable()
export class MockHiveRepository extends HiveChainRepository {
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

  async createAccountWithAuthority(
    newAccountname: string,
    authorityAccountname: string,
    options?: {
      posting_auths?: string[];
      active_auths?: string[];
    },
  ) {
    const owner = {
      weight_threshold: 1,
      account_auths: [[authorityAccountname, 1]],
      key_auths: [],
    };
    const active = {
      weight_threshold: 1,
      account_auths: [
        [authorityAccountname, 1],
        ...(options?.active_auths || []).map((e) => {
          return [e, 1];
        }),
      ],
      key_auths: [],
    };
    const posting = {
      weight_threshold: 1,
      account_auths: [
        [authorityAccountname, 1],
        ...(options?.posting_auths || []).map((e) => {
          return [e, 1];
        }),
      ],
      key_auths: [],
    };
    const memo_key = 'STM7C9FCSZ6ntNsrwkU5MCvAB7TV44bUF8J4pwWLWpGY5Z7Ba7Q6e';

    const accountData = {
      creator: authorityAccountname,
      new_account_name: newAccountname,
      owner,
      active,
      posting,
      memo_key,
      json_metadata: JSON.stringify({
        // beneficiaries: [
        //   {
        //     name: 'spk.beneficiary',
        //     weight: 500,
        //     label: 'provider',
        //   },
        // ],
      }),
      extensions: [],
    };

    const operations: Operation[] = [['create_claimed_account', accountData]];

    return { id: 'id', block_num: 1, expired: false, trx_num: 10 };
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
      hiveAccount.posting.key_auths.push([
        process.env.TEST_PUBLIC_KEY,
        hiveAccount.posting.weight_threshold,
      ]);
    return hiveAccount;
  }

  async isFollowing({
    follower,
    following,
  }: {
    follower: string;
    following: string;
  }): Promise<boolean> {
    if (process.env.TEST_IS_FOLLOWING) {
      return true;
    }
    return false;
  }

  async follow({
    data,
    isFollowing,
  }: {
    data: {
      required_auths: string[];
      required_posting_auths: string[];
      id: string;
      json: string;
    };
    isFollowing: boolean;
  }): Promise<{
    action: string;
    result: TransactionConfirmation;
  }> {
    if (isFollowing)
      return {
        action: 'unfollowed',
        result: { id: 'id', block_num: 1, trx_num: 1, expired: false },
      };

    return {
      action: 'followed',
      result: { id: 'id', block_num: 1, trx_num: 1, expired: false },
    };
  }
}
