import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import hiveJsPackage from '@hiveio/hive-js';
import { AuthorPerm, OperationsArray } from './types';
import {
  Client,
  ExtendedAccount,
  Operation,
  PrivateKey,
  PublicKey,
  Signature,
  TransactionConfirmation,
  cryptoUtils,
} from '@hiveio/dhive';
import crypto from 'crypto';
import 'dotenv/config';

hiveJsPackage.api.setOptions({
  useAppbaseApi: true,
  rebranded_api: true,
  url: `https://hive-api.web3telekom.xyz`,
});
hiveJsPackage.config.set('rebranded_api', 'true');

@Injectable()
export class HiveChainRepository {
  readonly #logger: Logger = new Logger(HiveChainRepository.name);
  readonly _hiveJs = hiveJsPackage;
  readonly _hive: Client = new Client(
    process.env.HIVE_HOST?.split(',') || [
      'https://anyx.io',
      'https://hived.privex.io',
      'https://rpc.ausbit.dev',
      'https://techcoderx.com',
      'https://api.openhive.network',
      'https://api.hive.blog',
      'https://api.c0ff33a.uk',
    ],
  );

  constructor() {}

  async broadcastOperations(operations: OperationsArray): Promise<any> {
    const broadcast = async (): Promise<any> => {
      return await this._hiveJs.broadcast.sendAsync(
        {
          operations,
        },
        {
          posting: process.env.DELEGATED_ACCOUNT_POSTING,
        },
      );
    };

    try {
      return await exponentialBackoff(broadcast);
    } catch (e) {
      this.#logger.error(`Error publishing operations to chain!`, operations, e);
      return e;
    }
  }

  async hivePostExists({ author, permlink }: AuthorPerm): Promise<boolean> {
    const fetchContent = async (): Promise<boolean> => {
      const content = await this._hiveJs.api.getContent(author, permlink);
      return typeof content === 'object' && !!content.body;
    };

    try {
      return await exponentialBackoff(fetchContent);
    } catch (e) {
      this.#logger.error('Error checking Hive post existence after retries:', e);
      return false;
    }
  }

  async hasEnoughRC({ author }: { author: string }): Promise<boolean> {
    const checkRC = async (): Promise<boolean> => {
      const rc = (await this._hive.rc.findRCAccounts([author])) as any[];
      const rcInBillion = rc[0].rc_manabar.current_mana / 1_000_000_000;
      return rcInBillion > 6;
    };

    try {
      return await exponentialBackoff(checkRC);
    } catch (e) {
      this.#logger.error('Error checking RC:', e);
      return false;
    }
  }

  async getCommentCount({ author, permlink }: AuthorPerm): Promise<number | undefined> {
    const fetchCommentCount = async (): Promise<number | undefined> => {
      const res: { children: number } = await this._hive.database.call('get_content', [
        author,
        permlink,
      ]);
      if (!res || isNaN(res.children)) {
        return undefined;
      }
      return res.children;
    };

    try {
      return await exponentialBackoff(fetchCommentCount);
    } catch (e) {
      this.#logger.error('Error getting comment count:', e);
      return undefined;
    }
  }

  async getAccount(author: string): Promise<ExtendedAccount | null> {
    const fetchAccount = async (): Promise<ExtendedAccount | null> => {
      const [hiveAccount] = await this._hive.database.getAccounts([author]);
      return hiveAccount;
    };

    try {
      return await exponentialBackoff(fetchAccount);
    } catch (e) {
      this.#logger.error('Error getting Hive account:', e);
      return null;
    }
  }

  async createAccountWithAuthority(
    newAccountname: string,
    authorityAccountname: string,
    options?: {
      posting_auths?: string[];
      active_auths?: string[];
    },
  ): Promise<any> {
    const createAccount = async (): Promise<any> => {
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

      return await this._hive.broadcast.sendOperations(
        operations,
        PrivateKey.fromString(process.env.ACCOUNT_CREATOR_ACTIVE || ''), // check this
      );
    };

    try {
      return await exponentialBackoff(createAccount);
    } catch (e) {
      this.#logger.error('Error creating Hive account with authority:', e);
      return null;
    }
  }

  async verifyHiveMessage(
    message: string,
    signature: string,
    account: ExtendedAccount,
  ): Promise<void> {
    const bufferMessage = cryptoUtils.sha256(message);
    let hasValidKey = false;

    for (const auth of account.posting.key_auths) {
      const publicKey = PublicKey.fromString(auth[0].toString());
      if (auth[1] < account.posting.weight_threshold) continue;

      hasValidKey = true;
      const signatureBuffer = Signature.fromBuffer(Buffer.from(signature, 'hex'));
      const verified = publicKey.verify(bufferMessage, signatureBuffer);
      if (verified) {
        return;
      }
    }

    if (!hasValidKey) {
      throw new UnauthorizedException('No valid keys found with sufficient weight');
    }

    throw new UnauthorizedException('The message did not match the signature');
  }

  async vote(options: {
    author: string;
    permlink: string;
    voter: string;
    weight: number;
  }): Promise<any> {
    if (options.weight < -10_000 || options.weight > 10_000) {
      this.#logger.error(
        `Vote weight was out of bounds: ${options.weight}. Skipping ${options.author}/${options.permlink}`,
      );
      throw new BadRequestException(
        'Hive vote weight out of bounds. Must be between -10000 and 10000',
      );
    }

    const castVote = async (): Promise<any> => {
      return this._hive.broadcast.vote(
        options,
        PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING || ''),
      );
    };

    try {
      return await exponentialBackoff(castVote);
    } catch (e) {
      this.#logger.error(`Error voting on ${options.author}/${options.permlink}:`, e);
      throw new BadRequestException('Error voting on post');
    }
  }

  async getActiveVotes({ author, permlink }: { author: string; permlink: string }): Promise<any[]> {
    const fetchActiveVotes = async (): Promise<any[]> => {
      return await this._hive.database.call('get_active_votes', [author, permlink]);
    };

    try {
      return await exponentialBackoff(fetchActiveVotes);
    } catch (e) {
      this.#logger.error('Error getting active votes:', e);
      return [];
    }
  }

  decodeMessage(memo: string): any {
    try {
      const decoded: string = this._hiveJs.memo.decode(process.env.DELEGATED_ACCOUNT_POSTING, memo);
      const message: unknown = JSON.parse(decoded.substr(1));

      return message;
    } catch (e) {
      this.#logger.error('Error decoding message:', e);
      return null;
    }
  }

  async getPublicKeys(memo: string): Promise<string[]> {
    const fetchPublicKeys = async (): Promise<string[]> => {
      return this._hiveJs.memo.getPubKeys(memo);
    };

    try {
      return await exponentialBackoff(fetchPublicKeys);
    } catch (e) {
      this.#logger.error('Error getting public keys:', e);
      return [];
    }
  }

  async comment(
    author: string,
    content: string,
    comment_options: { parent_author: string; parent_permlink: string },
  ): Promise<TransactionConfirmation> {
    const postComment = async (): Promise<TransactionConfirmation> => {
      return await this._hive.broadcast.comment(
        {
          parent_author: comment_options.parent_author || '',
          parent_permlink: comment_options.parent_permlink || '',
          author,
          permlink: crypto.randomBytes(8).toString('base64url').toLowerCase().replace('_', ''),
          title: '',
          body: content,
          json_metadata: JSON.stringify({
            app: 'threespeak.beta/0.1',
          }),
        },
        PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING || ''),
      );
    };

    try {
      return await exponentialBackoff(postComment);
    } catch (e) {
      this.#logger.error('Error posting comment:', e);
      throw new Error('Could not post comment');
    }
  }

  verifyPostingAuth(account: ExtendedAccount): boolean {
    if (!Array.isArray(account.posting.account_auths)) {
      return false;
    }

    for (const item of account.posting.account_auths) {
      if (item[0] === process.env.DELEGATED_ACCOUNT) {
        return true;
      }
    }

    return false;
  }
}
