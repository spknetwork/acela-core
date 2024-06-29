import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  AccountType,
  Network,
  UserRequest,
  accountTypes,
  interceptedRequestSchema,
} from './auth.types';

export function parseAndValidateRequest(request: unknown, logger: Logger): UserRequest {
  let parsedRequest: UserRequest;
  try {
    parsedRequest = interceptedRequestSchema.parse(request);
  } catch (e) {
    logger.error(e);
    throw new HttpException({ reason: e, errorType: 'MISSING_USER' }, HttpStatus.FORBIDDEN);
  }
  return parsedRequest;
}

export function parseSub(sub: string): {
  accountType: AccountType;
  account: string;
  network: Network;
} {
  const [accountType, account, network] = sub.split('/');

  if (!accountTypes.includes(accountType as AccountType)) {
    throw new Error(`Invalid account type: ${accountType}`);
  }

  if (!network.includes(network as Network)) {
    throw new Error(`Invalid network: ${network}`);
  }

  return {
    accountType: accountType as AccountType,
    account,
    network: network as Network,
  };
}
