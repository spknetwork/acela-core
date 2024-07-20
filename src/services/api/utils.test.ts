
import { Ed25519Provider } from 'key-did-provider-ed25519';
import * as KeyResolver from 'key-did-resolver';
import { DID } from 'dids';
import { Response } from 'express';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { jest } from '@jest/globals';
import { toString } from 'uint8arrays/to-string';
import { decode } from 'codeco';
import { DagJWS, uint8ArrayAsBase64pad, uint8ArrayAsBase64url } from '@didtools/codecs';
import { AuthInterceptor } from './utils';
import { WithAuthData } from '../auth/auth.interface';

export function encodeBase64(bytes: Uint8Array): string {
    return uint8ArrayAsBase64pad.encode(bytes);
}

export function encodeBase64Url(bytes: Uint8Array): string {
    return uint8ArrayAsBase64url.encode(bytes);
}

export function decodeBase64(s: string): Uint8Array {
    return decode(uint8ArrayAsBase64pad, s);
}

export function base64urlToJSON(s: string): Record<string, any> {
    const decoded = decode(uint8ArrayAsBase64url, s);
    return JSON.parse(toString(decoded)) as Record<string, any>;
}

describe('AuthInterceptor', () => {
    let authInterceptor: AuthInterceptor;
    const seedBuf = new Uint8Array(32);
    seedBuf.fill(27);
    const key = new Ed25519Provider(seedBuf);
    const did = new DID({ provider: key, resolver: KeyResolver.getResolver() });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthInterceptor,
                {
                    provide: 'APP_INTERCEPTOR',
                    useClass: AuthInterceptor,
                },
            ],
        }).compile();

        authInterceptor = module.get<AuthInterceptor>(AuthInterceptor);
    });

    const createExecutionContext = (req: any, res: Response, next: any): ExecutionContext => ({
        switchToHttp: () => ({
            getRequest: () => req,
            getResponse: () => res,
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
    } as unknown as ExecutionContext);

    describe('intercept', () => {
        it('should set request body to JWS data', async () => {
            await did.authenticate();

            const reqBody = {
                some: 'data',
                num: 53,
                did: did.id,
                iat: Date.now(),
            } satisfies WithAuthData<{ some: string; num: number }>;

            const jws = await did.createJWS(reqBody);

            const req: { body: DagJWS } = {
                body: jws,
            };

            const res = {} as Response;
            const next = {
                handle: jest.fn(() => of(null)),
            } as unknown as CallHandler;

            const context = createExecutionContext(req, res, next);

            await authInterceptor.intercept(context, next);
            expect(reqBody).toEqual(req.body);
            expect(next.handle).toHaveBeenCalled();
        });

        it('should return 401 if JWS is invalid', async () => {
            await did.authenticate();

            const reqBody = {
                some: 'data',
                num: 53,
                did: did.id,
                iat: Date.now(),
            } satisfies WithAuthData<{ some: string; num: number }>;

            const jws = await did.createJWS(reqBody);
            const invalidJWS: DagJWS = {
                ...jws,
                signatures: jws.signatures.map((s) => ({
                    ...s,
                    signature: 'invalid',
                })),
            };

            const req: { body: DagJWS } = {
                body: invalidJWS,
            };

            const res = {
                status: jest.fn(() => res),
                send: jest.fn(() => res),
            } as unknown as Response;
            const next = {
                handle: jest.fn(),
            } as unknown as CallHandler;

            const context = createExecutionContext(req, res, next);

            try {
                await authInterceptor.intercept(context, next);
            } catch (error) {
                expect(error.status).toBe(401);
                expect(error.message).toBe('Invalid signature');
            }
        });

        it('should return 401 if DID is invalid', async () => {
            await did.authenticate();

            const reqBody = {
                some: 'data',
                num: 53,
                did: 'did:key:invalid',
                iat: Date.now(),
            } satisfies WithAuthData<{ some: string; num: number }>;

            const jws = await did.createJWS(reqBody);

            const req: { body: DagJWS } = {
                body: jws,
            };

            const res = {
                status: jest.fn(() => res),
                send: jest.fn(() => res),
            } as unknown as Response;
            const next = {
                handle: jest.fn(),
            } as unknown as CallHandler;

            const context = createExecutionContext(req, res, next);

            try {
                await authInterceptor.intercept(context, next);
            } catch (error) {
                expect(error.status).toBe(401);
                expect(error.message).toBe('Invalid DID');
            }
        });

        it('should return 401 if timestamp is invalid', async () => {
            await did.authenticate();

            const reqBody = {
                some: 'data',
                num: 53,
                did: did.id,
                iat: Date.now() - 1000 * 60 * 6,
            } satisfies WithAuthData<{ some: string; num: number }>;

            const jws = await did.createJWS(reqBody);

            const req: { body: DagJWS } = {
                body: jws,
            };

            const res = {
                status: jest.fn(() => res),
                send: jest.fn(() => res),
            } as unknown as Response;
            const next = {
                handle: jest.fn(),
            } as unknown as CallHandler;

            const context = createExecutionContext(req, res, next);

            try {
                await authInterceptor.intercept(context, next);
            } catch (error) {
                expect(error.status).toBe(401);
                expect(error.message).toBe('Invalid timestamp');
            }
        });
    });
});
