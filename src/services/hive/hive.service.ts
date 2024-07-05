import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  LoggerService,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import 'dotenv/config';
import { HiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { Network } from '../auth/auth.types';
import { parseSub } from '../auth/auth.utils';
import { LinkedAccountRepository } from '../../repositories/linked-accounts/linked-account.repository';
import { LinkedAccount } from '../../repositories/linked-accounts/schemas/linked-account.schema';

@Injectable()
export class HiveService {
  readonly #hiveChainRepository: HiveChainRepository;
  readonly #hiveAccountRepository: HiveAccountRepository;
  readonly #linkedAccountsRepository: LinkedAccountRepository;
  readonly #logger: LoggerService = new Logger(HiveService.name);

  constructor(
    hiveAccountRepository: HiveAccountRepository,
    hiveChainRepository: HiveChainRepository,
    linkedAccountRepository: LinkedAccountRepository,
  ) {
    this.#hiveChainRepository = hiveChainRepository;
    this.#hiveAccountRepository = hiveAccountRepository;
    this.#linkedAccountsRepository = linkedAccountRepository;
  }

  async vote({
    votingAccount,
    sub,
    author,
    permlink,
    weight,
    network,
  }: {
    votingAccount: string;
    sub: string;
    author: string;
    permlink: string;
    weight: number;
    network: Network;
  }) {
    // TODO: investigate how this could be reused on other methods that access accounts onchain
    if (network === 'hive' && parseSub(sub).account === votingAccount) {
      return this.#hiveChainRepository.vote({ author, permlink, voter: votingAccount, weight });
    }

    const delegatedAuth = await this.#hiveAccountRepository.findOneByOwnerIdAndHiveAccountName({
      account: votingAccount,
      user_id: sub,
    });

    if (!delegatedAuth) {
      throw new UnauthorizedException('You have not verified ownership of the target account');
    }

    return this.#hiveChainRepository.vote({ author, permlink, voter: votingAccount, weight });
  }

  async requestHiveAccount(hiveUsername: string, sub: string) {
    const existingDbAcocunt = await this.#hiveAccountRepository.findOneByOwnerId({
      user_id: sub,
    });

    if (existingDbAcocunt) {
      throw new HttpException(
        { reason: 'You have already created the maximum of 1 free Hive account' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const accountCreation = await this.#createAccountWithAuthority(hiveUsername, sub);

    await this.insertCreated(hiveUsername, sub);

    return accountCreation;
  }

  async #createAccountWithAuthority(hiveUsername: string, sub: string) {
    if (!process.env.ACCOUNT_CREATOR) {
      throw new Error('Please set the ACCOUNT_CREATOR env var');
    }
    try {
      const accountWithAuthority = await this.#hiveChainRepository.createAccountWithAuthority(
        hiveUsername,
        process.env.ACCOUNT_CREATOR,
      );
      await this.#linkedAccountsRepository.linkHiveAccount(sub, hiveUsername);
      return accountWithAuthority;
    } catch (ex) {
      throw new HttpException({ reason: `On chain error - ${ex.message}` }, HttpStatus.BAD_REQUEST);
    }
  }

  async insertCreated(hiveUsername: string, sub: string) {
    await this.#hiveAccountRepository.insertCreated(hiveUsername, sub);
  }

  async linkHiveAccount(sub: string, hiveUsername: string, proof: string): Promise<LinkedAccount> {
    const linkedAccount = await this.#linkedAccountsRepository.findOneByUserIdAndAccountName({
      user_id: sub,
      account: hiveUsername,
    });
    if (linkedAccount) {
      throw new HttpException({ reason: 'Hive account already linked' }, HttpStatus.BAD_REQUEST);
    }
    const hiveAccount = await this.#hiveChainRepository.getAccount(hiveUsername);
    if (!hiveAccount)
      throw new NotFoundException(`Requested hive account (${hiveAccount}) could not be found.`);
    await this.#hiveChainRepository.verifyHiveMessage(
      `${sub} is the owner of @${hiveUsername}`,
      proof,
      hiveAccount,
    );
    return (await this.#linkedAccountsRepository.linkHiveAccount(
      sub,
      hiveUsername,
    )) satisfies LinkedAccount;
  }

  async isHiveAccountLinked(sub: string, accountName: string) {
    return !!(await this.#linkedAccountsRepository.findOneByUserIdAndAccountName({
      user_id: sub,
      account: accountName,
    }));
  }
}
