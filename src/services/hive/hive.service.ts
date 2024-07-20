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
import { LegacyHiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { Network } from '../auth/auth.types';
import { parseSub } from '../auth/auth.utils';
import { ObjectId } from 'mongodb';
import { LegacyUserRepository } from '../../repositories/user/user.repository';

@Injectable()
export class HiveService {
  readonly #hiveChainRepository: HiveChainRepository;
  readonly #legacyHiveAccountRepository: LegacyHiveAccountRepository;
  readonly #legacyUserRepository: LegacyUserRepository;
  readonly #logger: LoggerService = new Logger(HiveService.name);

  constructor(
    legacyHiveAccountRepository: LegacyHiveAccountRepository,
    hiveChainRepository: HiveChainRepository,
    legacyUserRepository: LegacyUserRepository,
  ) {
    this.#hiveChainRepository = hiveChainRepository;
    this.#legacyHiveAccountRepository = legacyHiveAccountRepository;
    this.#legacyUserRepository = legacyUserRepository;
  }

  async vote({
    votingAccount,
    user_id,
    sub,
    author,
    permlink,
    weight,
    network,
  }: {
    votingAccount: string;
    user_id: ObjectId;
    sub: string;
    author: string;
    permlink: string;
    weight: number;
    network: Network;
  }) {
    // TODO: investigate how this could be reused on other methods that access accounts onchain
    const parsedSub = parseSub(sub);
    if (parsedSub.network === 'hive' && parsedSub.account === votingAccount) {
      return this.#hiveChainRepository.vote({ author, permlink, voter: votingAccount, weight });
    }

    const delegatedAuth =
      await this.#legacyHiveAccountRepository.findOneByOwnerIdAndHiveAccountName({
        account: votingAccount,
        user_id,
      });

    if (!delegatedAuth) {
      throw new UnauthorizedException('You have not verified ownership of the target account');
    }

    return this.#hiveChainRepository.vote({ author, permlink, voter: votingAccount, weight });
  }

  async requestHiveAccount(hiveUsername: string, user_id: string) {
    const linkedAccounts = await this.#legacyUserRepository.getLegacyLinkedHiveAccounts(user_id);

    if (!linkedAccounts) {
      throw new NotFoundException("Account couldn't be found");
    }

    if (linkedAccounts.linked_hiveaccounts.length) {
      throw new HttpException(
        { reason: 'You have already linked a hive account, so cannot claim a free one.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const accountCreation = await this.#createAccountWithAuthority(
      hiveUsername,
      linkedAccounts._id,
    );

    return accountCreation;
  }

  async #createAccountWithAuthority(hiveUsername: string, user_id: ObjectId) {
    if (!process.env.ACCOUNT_CREATOR) {
      throw new Error('Please set the ACCOUNT_CREATOR env var');
    }
    try {
      const accountWithAuthority = await this.#hiveChainRepository.createAccountWithAuthority(
        hiveUsername,
        process.env.ACCOUNT_CREATOR,
      );
      await this.#legacyHiveAccountRepository.insertCreated({ account: hiveUsername, user_id });
      return accountWithAuthority;
    } catch (ex) {
      throw new HttpException({ reason: `On chain error - ${ex.message}` }, HttpStatus.BAD_REQUEST);
    }
  }

  async insertCreated(hiveUsername: string, user_id: ObjectId) {
    await this.#legacyHiveAccountRepository.insertCreated({ account: hiveUsername, user_id });
  }

  async linkHiveAccount({
    db_user_id,
    user_id,
    hiveUsername,
    proof,
  }: {
    db_user_id: ObjectId;
    user_id: string;
    hiveUsername: string;
    proof: string;
  }) {
    const linkedAccount =
      await this.#legacyHiveAccountRepository.findOneByOwnerIdAndHiveAccountName({
        user_id: db_user_id,
        account: hiveUsername,
      });
    if (linkedAccount) {
      throw new HttpException({ reason: 'Hive account already linked' }, HttpStatus.BAD_REQUEST);
    }
    const hiveAccount = await this.#hiveChainRepository.getAccount(hiveUsername);
    if (!hiveAccount)
      throw new NotFoundException(`Requested hive account (${hiveAccount}) could not be found.`);
    await this.#hiveChainRepository.verifyHiveMessage(
      `${user_id} is the owner of @${hiveUsername}`,
      proof,
      hiveAccount,
    );
    return await this.#legacyHiveAccountRepository.insertCreated({
      account: hiveUsername,
      user_id: db_user_id,
    });
  }

  async isHiveAccountLinked({ user_id, account }: { user_id: ObjectId; account: string }) {
    return !!(await this.#legacyHiveAccountRepository.findOneByOwnerIdAndHiveAccountName({
      user_id,
      account,
    }));
  }

  async authorizedToUseHiveAccount({
    hiveAccount,
    user_id,
    sub,
  }: {
    hiveAccount: string;
    user_id: string;
    sub?: string;
  }): Promise<void> {
    const dbUser = await this.#legacyUserRepository.findOneByUserId({ user_id });
    if (!dbUser) throw new UnauthorizedException('User does not exist');
    if (sub) {
      const user = parseSub(sub);
      if (user.account === hiveAccount || user.network === 'hive') {
        return;
      }
    }
    const hasLinkedAccount =
      await this.#legacyHiveAccountRepository.findOneByOwnerIdAndHiveAccountName({
        user_id: dbUser._id,
        account: hiveAccount,
      });
    if (hasLinkedAccount) {
      return;
    }
    throw new UnauthorizedException(
      'you are not logged in or do not have a link to this hive account',
    );
  }
}
