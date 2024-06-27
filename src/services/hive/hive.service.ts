import { HttpException, HttpStatus, Injectable, Logger, LoggerService } from '@nestjs/common';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import 'dotenv/config';
import { HiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';

@Injectable()
export class HiveService {
  readonly #hiveRepository: HiveChainRepository;
  readonly #hiveAccountRepository: HiveAccountRepository;
  readonly #logger: LoggerService = new Logger(HiveService.name);

  constructor(hiveAccountRepository: HiveAccountRepository, hiveRepository: HiveChainRepository) {
    this.#hiveRepository = hiveRepository;
    this.#hiveAccountRepository = hiveAccountRepository;
  }

  async requestHiveAccount(hiveUsername: string, sub: string) {
    const existingDbAcocunt = await this.#hiveAccountRepository.findOneByOwnerId({
      user_id: sub,
    });

    console.log(existingDbAcocunt);

    if (existingDbAcocunt) {
      throw new HttpException(
        { reason: 'You have already created the maximum of 1 free Hive account' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const accountCreation = await this.#createAccountWithAuthority(hiveUsername);

    console.log(accountCreation);

    await this.insertCreated(hiveUsername, sub);

    return accountCreation;
  }

  async #createAccountWithAuthority(hiveUsername: string) {
    if (!process.env.ACCOUNT_CREATOR) {
      throw new Error('Please set the ACCOUNT_CREATOR env var');
    }
    try {
      return await this.#hiveRepository.createAccountWithAuthority(
        hiveUsername,
        process.env.ACCOUNT_CREATOR,
      );
    } catch (ex) {
      throw new HttpException({ reason: `On chain error - ${ex.message}` }, HttpStatus.BAD_REQUEST);
    }
  }

  async insertCreated(hiveUsername: string, sub: string) {
    await this.#hiveAccountRepository.insertCreated(hiveUsername, sub);
  }
}
