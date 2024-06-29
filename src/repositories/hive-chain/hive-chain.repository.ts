import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import hiveJsPackage from '@hiveio/hive-js';
import { AuthorPerm, OperationsArray } from './types';
import {
  Client,
  ExtendedAccount,
  Operation,
  PrivateKey,
  PublicKey,
  Signature,
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

  async broadcastOperations(operations: OperationsArray) {
    return await this._hiveJs.broadcast
      .sendAsync(
        {
          operations,
        },
        {
          posting: process.env.DELEGATED_ACCOUNT_POSTING,
        },
      )
      .catch((e: any) => {
        this.#logger.error(`Error publishing operations to chain!`, operations, e);
        return e;
      });
  }

  async hivePostExists({ author, permlink }: AuthorPerm) {
    try {
      const content = await this._hiveJs.api.getContent(author, permlink);
      // Check if the content is an object and has a body. This implicitly checks for non-empty strings.
      return typeof content === 'object' && !!content.body;
    } catch (e) {
      this.#logger.error('Error checking Hive post existence:', e);
      return false;
    }
  }

  async hasEnoughRC({ author }: { author: string }): Promise<boolean> {
    try {
      const rc = (await this._hive.rc.findRCAccounts([author])) as any[];
      const rcInBillion = rc[0].rc_manabar.current_mana / 1_000_000_000;
      console.log(`Resource Credits for ${author}:`, rcInBillion);
      return rcInBillion > 6;
    } catch (e) {
      this.#logger.error('Error checking Hive post existence:', e);
      return false;
    }
  }

  async getCommentCount({ author, permlink }: AuthorPerm): Promise<number | undefined> {
    const res: { children: number } = await this._hive.database.call('get_content', [
      author,
      permlink,
    ]);
    if (!res || isNaN(res.children)) {
      return undefined;
    }
    return res.children;
  }

  async getAccount(author: string) {
    const [hiveAccount] = await this._hive.database.getAccounts([author]);
    return hiveAccount;
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

    return await this._hive.broadcast.sendOperations(
      operations,
      PrivateKey.fromString(process.env.ACCOUNT_CREATOR_ACTIVE || ''), // check this
    );
  }

  verifyHiveMessage(message: Buffer, signature: string, account: ExtendedAccount): boolean {
    for (const auth of account.posting.key_auths) {
      const publicKey = PublicKey.fromString(auth[0].toString());
      if (auth[1] < account.posting.weight_threshold) continue;
      try {
        const signatureBuffer = Signature.fromBuffer(Buffer.from(signature, 'hex'));
        const verified = publicKey.verify(message, signatureBuffer);
        if (verified) {
          return true;
        }
      } catch (e) {
        this.#logger.debug(e);
      }
    }
    return false;
  }

  async vote(options: { author: string; permlink: string; voter: string; weight: number }) {
    if (options.weight < -10_000 || options.weight > 10_000) {
      this.#logger.error(
        `Vote weight was out of bounds: ${options.weight}. Skipping ${options.author}/${options.permlink}`,
      );
      throw new BadRequestException('Hive vote weight out of bounds. Must be between -10000 and 10000');
    }
    return this._hive.broadcast.vote(
      options,
      PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING || ''),
    );
  }

  async getActiveVotes({ author, permlink }: { author: string; permlink: string }) {
    return await this._hive.database.call('get_active_votes', [author, permlink]);
  }

  decodeMessage(memo: string) {
    const decoded: string = this._hiveJs.memo.decode(process.env.DELEGATED_ACCOUNT_POSTING, memo);
    const message: unknown = JSON.parse(decoded.substr(1));

    return message;
  }

  async getPublicKeys(memo: string): Promise<string[]> {
    return this._hiveJs.memo.getPubKeys(memo);
  }

  async comment(
    author: string,
    content: string,
    comment_options: { parent_author: string; parent_permlink: string },
  ) {
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
  }

  verifyPostingAuth(account: ExtendedAccount): boolean {
    let doWe = false;
    if (Array.isArray(account.posting.account_auths)) {
      account.posting.account_auths.forEach(function (item) {
        if (item[0] === process.env.DELEGATED_ACCOUNT) {
          doWe = true;
        }
      });
      return doWe;
    } else {
      return false;
    }
  }
}
