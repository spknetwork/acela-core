import { HttpException, HttpStatus } from '@nestjs/common';
import { UserRequest, interceptedRequestSchema } from './auth.types';

export function parseAndValidateRequest(request: unknown, logger: any): UserRequest {
  let parsedRequest: UserRequest;
  try {
    parsedRequest = interceptedRequestSchema.parse(request);
  } catch (e) {
    logger.error(e);
    throw new HttpException({ reason: e, errorType: 'MISSING_USER' }, HttpStatus.FORBIDDEN);
  }
  return parsedRequest;
}
