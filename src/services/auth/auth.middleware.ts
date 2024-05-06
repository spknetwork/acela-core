import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { authSchema } from './auth.interface';
import * as KeyDidResolver from 'key-did-resolver'
import { DID, VerifyJWSResult } from 'dids'

const verifier = new DID({ resolver: KeyDidResolver.getResolver() });

const VALID_TIMESTAMP_DIFF_MS = 1000 * 60 * 5;

export function isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    return diff < VALID_TIMESTAMP_DIFF_MS;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    async use(req: Request, res: Response, next: NextFunction) {
        let verificationResult: VerifyJWSResult
        try {
            verificationResult = await verifier.verifyJWS(req.body);
        } catch {
            res.status(401).send('Invalid signature');
            return;
        }

        console.log(verificationResult)

        console.log(req.body)

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
            res.status(401).send('Invalid timestamp');
            return;
        }

        req.body = verificationResult.payload;

        next();
    }
}