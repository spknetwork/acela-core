import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import hiveJsPackage from '@hiveio/hive-js';
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
import { AuthorPerm, OperationsArray } from './types';

hiveJsPackage.api.setOptions({
  useAppbaseApi: true,
  rebranded_api: true,
  url: `https://hive-api.web3telekom.xyz`,
});
hiveJsPackage.config.set('rebranded_api', 'true');

@Injectable()
export class HiveChainRepository {
  readonly #logger: Logger = new Logger(HiveChainRepository.name);
  readonly _hive: Client;

  constructor(hiveClient: Client) {
    this._hive = hiveClient;
  }

  async broadcastOperations(operations: OperationsArray): Promise<any> {
    try {
      return await hiveJsPackage.broadcast.sendAsync(
        {
          operations,
        },
        {
          posting: process.env.DELEGATED_ACCOUNT_POSTING,
        },
      );
    } catch (e) {
      this.#logger.error(`Error publishing operations to chain!`, operations, e);
      return e;
    }
  }

  async hivePostExists({
    author,
    permlink,
  }: {
    author: string;
    permlink: string;
  }): Promise<boolean> {
    try {
      const content = await this._hive.database.call('get_content', [author, permlink]);
      return typeof content === 'object' && !!content.body;
    } catch (e) {
      this.#logger.error('Error checking Hive post existence:', e);
      return false;
    }
  }

  async hasEnoughRC({ author }: { author: string }): Promise<boolean> {
    try {
      const rc = await this._hive.rc.findRCAccounts([author]);
      const rcInBillion = Number(rc[0].rc_manabar.current_mana) / 1_000_000_000;
      return rcInBillion > 6;
    } catch (e) {
      this.#logger.error('Error checking RC:', e);
      return false;
    }
  }

  async getCommentCount({ author, permlink }: AuthorPerm, defaultCount = 0): Promise<number> {
    try {
      const res: { children: number } = await this._hive.database.call('get_content', [
        author,
        permlink,
      ]);
      if (!res || isNaN(res.children)) {
        return defaultCount;
      }
      return res.children;
    } catch (e) {
      this.#logger.error('Error getting comment count:', e);
      return defaultCount;
    }
  }

  async getAccount(author: string): Promise<ExtendedAccount | null> {
    try {
      const [hiveAccount] = await this._hive.database.getAccounts([author]);
      return hiveAccount;
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
    try {
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
        PrivateKey.fromString(process.env.ACCOUNT_CREATOR_ACTIVE || ''),
      );
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

    try {
      return this._hive.broadcast.vote(
        options,
        PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING || ''),
      );
    } catch (e) {
      this.#logger.error(`Error voting on ${options.author}/${options.permlink}:`, e);
      throw new BadRequestException('Error voting on post');
    }
  }

  async isFollowing({ follower, following }: { follower: string; following: string }) {
    try {
      const status = await this._hive.call('follow_api', 'get_following', [
        follower,
        following,
        'blog',
        1,
      ]);
      return status.length > 0 && status[0].following === following;
    } catch (e) {
      this.#logger.error(`Error checking if ${follower} is following ${following}:`, e);
      return false;
    }
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
    try {
      const result = await this._hive.broadcast.json(
        data,
        PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING),
      );
      return { action: isFollowing ? 'unfollowed' : 'followed', result };
    } catch (e) {
      this.#logger.error(`Error ${isFollowing ? 'unfollowing' : 'following'}:`, e);
      throw new ServiceUnavailableException(e);
    }
  }

  async getActiveVotes({ author, permlink }: { author: string; permlink: string }): Promise<any[]> {
    try {
      return await this._hive.database.call('get_active_votes', [author, permlink]);
    } catch (e) {
      this.#logger.error('Error getting active votes:', e);
      return [];
    }
  }

  decodeMessage(memo: string): any {
    try {
      const decoded: string = hiveJsPackage.memo.decode(
        process.env.DELEGATED_ACCOUNT_POSTING,
        memo,
      );
      const message: unknown = JSON.parse(decoded.substr(1));

      return message;
    } catch (e) {
      this.#logger.error('Error decoding message:', e);
      return null;
    }
  }

  async getPublicKeys(memo: string): Promise<string[]> {
    try {
      return await hiveJsPackage.memo.getPubKeys(memo);
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
    try {
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
    } catch (e) {
      this.#logger.error('Error posting comment:', e);
      throw new Error('Could not post comment ' + e);
    }
  }

  verifyPostingAuth(account: ExtendedAccount): boolean {
    if (!Array.isArray(account.posting.account_auths)) {
      return false;
    }

    return account.posting.account_auths.some((item) => item[0] === process.env.DELEGATED_ACCOUNT);
  }
}
