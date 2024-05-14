import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { authSchema } from './auth.interface';
import * as KeyDidResolver from 'key-did-resolver';
import { DID, DagJWS, VerifyJWSResult } from 'dids';

const VALID_TIMESTAMP_DIFF_MS = 1000 * 60 * 5;

export function isValidTimestamp(timestamp: number): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff < VALID_TIMESTAMP_DIFF_MS;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: Request<any, any, string | DagJWS>, res: Response, next: NextFunction) {
    let verificationResult: VerifyJWSResult;
    const verifier = new DID({ resolver: KeyDidResolver.getResolver() });
    try {
      verificationResult = await verifier.verifyJWS(req.body);
    } catch {
      console.error('Invalid signature');
      res.status(401).send('Invalid signature');
      return;
    }

    const authData = authSchema.parse(verificationResult.payload);
    const { did, iat } = authData;

    //new Date(proof_payload.ts) > moment().subtract('1', 'minute').toDate()

    if (did !== verificationResult.kid.split('#')[0]) {
      console.error('Invalid DID:', did);
      console.error('Expected DID:', verificationResult.kid);
      res.status(401).send('Invalid DID');
      return;
    }

    if (!isValidTimestamp(iat)) {
      console.error('Invalid timestamp:', iat);
      res.status(401).send('Invalid timestamp');
      return;
    }

    req.body = verificationResult.payload as DagJWS;

    next();
  }
}
