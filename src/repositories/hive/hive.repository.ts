import { Injectable, Logger } from '@nestjs/common';
import hiveJsPackage from '@hiveio/hive-js';
import { OperationsArray } from "./types";
import { Client } from '@hiveio/dhive';
import { HiveClient } from '../../utils/hiveClient';

hiveJsPackage.api.setOptions({
  useAppbaseApi: true,
  rebranded_api: true,
  url: `https://hive-api.web3telekom.xyz`
});
hiveJsPackage.config.set('rebranded_api','true');

@Injectable()
export class HiveRepository {
  readonly #logger: Logger;
  readonly #hiveJs = hiveJsPackage;
  readonly #hive: Client = HiveClient;

  constructor() {}

  async broadcastOperations(operations: OperationsArray) {
    return await this.#hiveJs.broadcast.sendAsync({
      operations
    }, {
      posting: process.env.DELEGATED_ACCOUNT_POSTING
    }).catch((e: any) => {
      this.#logger.error(`Error publishing operations to chain!`, operations, e)
      return e;
    });
  }

  async hivePostExists({ author, permlink }: {author: string, permlink: string }) {
    try {
      const content = await this.#hiveJs.api.getContent(author, permlink);
  
      // Check if the content is an object and has a body. This implicitly checks for non-empty strings.
      return typeof content === "object" && !!content.body;
    } catch (e) {
      this.#logger.error("Error checking Steem post existence:", e);
      return false;
    }
  }

  async getAccount(author: string) {
    const [hiveAccount] = await this.#hive.database.call('lookup_accounts',[author, 1]);
    return hiveAccount;
  }
}
