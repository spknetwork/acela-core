import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@hiveio/dhive';
import { exponentialBackoff } from '../../utils/exponentialBackoff';

@Injectable()
export class HiveChainConfigService {
  constructor(private readonly configService: ConfigService) {}

  createHiveClient(): Client {
    const hiveHosts = [
      'https://hive-api.web3telekom.xyz/',
      ...(this.configService.get<string>('HIVE_HOST')?.split(',') || []),
      'https://anyx.io',
      'https://hived.privex.io',
      'https://rpc.ausbit.dev',
      'https://techcoderx.com',
      'https://api.openhive.network',
      'https://api.hive.blog',
      'https://api.c0ff33a.uk',
    ];

    return new Client(hiveHosts, {
      backoff: (tries) => exponentialBackoff(tries),
      failoverThreshold: 1,
      consoleOnFailover: true,
      timeout: 1000,
    });
  }
}
