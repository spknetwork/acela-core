import { AuthData, WithAuthData } from "./auth.interface";
import { AuthMiddleware } from "./auth.middleware";
import { Ed25519Provider } from 'key-did-provider-ed25519'
import * as KeyResolver from 'key-did-resolver'
import { DID } from 'dids'
import { Response } from 'express'
import { jest } from '@jest/globals'
import { toString } from 'uint8arrays/to-string'
import { decode } from 'codeco'
import { type DagJWS, uint8ArrayAsBase64pad, uint8ArrayAsBase64url } from '@didtools/codecs'

export function encodeBase64(bytes: Uint8Array): string {
    return uint8ArrayAsBase64pad.encode(bytes)
}

export function encodeBase64Url(bytes: Uint8Array): string {
    return uint8ArrayAsBase64url.encode(bytes)
}

export function decodeBase64(s: string): Uint8Array {
    return decode(uint8ArrayAsBase64pad, s)
}

export function base64urlToJSON(s: string): Record<string, any> {
    const decoded = decode(uint8ArrayAsBase64url, s)
    return JSON.parse(toString(decoded)) as Record<string, any>
}


describe('AuthMiddleware', () => {
    let authMiddleware: AuthMiddleware
    const seedBuf = new Uint8Array(32);
    seedBuf.fill(27);
    const key = new Ed25519Provider(seedBuf)
    const did = new DID({ provider: key, resolver: KeyResolver.getResolver() })

    beforeEach(() => {
        authMiddleware = new AuthMiddleware();
    });

    describe('use', () => {
        it('should set request body to JWS data', async () => {
            await did.authenticate()

            const reqBody = {
                some: 'data',
                num: 53,
                did: did.id,
                iat: Date.now()
            } satisfies WithAuthData<{
                some: string;
                num: number;
            }>

            const jws = await did.createJWS(reqBody)

            const req: { body: DagJWS } = {
                body: jws
            }

            const res = jest.mocked<Response>({} as any)
            const next = jest.fn()

            await authMiddleware.use(req as any, res, next)
            expect(reqBody).toEqual(req.body)
            expect(next).toHaveBeenCalled()
        });

        it('should return 401 if JWS is invalid', async () => {
            await did.authenticate()
            const reqBody = {
                some: 'data',
                num: 53,
                did: did.id,
                iat: Date.now()
            } satisfies WithAuthData<{
                some: string;
                num: number;
            }>
            const jws = await did.createJWS(reqBody)
            const req: { body: DagJWS } = {
                body: jws
            }
            const res = jest.mocked<Response>({ status: jest.fn(() => res), send: jest.fn(() => res) } as any)
            const next = jest.fn()
            const invalidJWS: DagJWS = {
                ...jws,
                signatures: jws.signatures.map(s => ({
                    ...s,
                    signature: 'invalid'
                }))
            }
            req.body = invalidJWS
            await authMiddleware.use(req as any, res, next)
            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.send).toHaveBeenCalledWith('Invalid signature')
            expect(next).not.toHaveBeenCalled()
        });

        it('should return 401 if DID is invalid', async () => {
            await did.authenticate()
            const reqBody = {
                some: 'data',
                num: 53,
                did: 'did:key:invalid',
                iat: Date.now()
            } satisfies WithAuthData<{
                some: string;
                num: number;
            }>
            const jws = await did.createJWS(reqBody)
            const req: { body: DagJWS } = {
                body: jws
            }
            const res = jest.mocked<Response>({ status: jest.fn(() => res), send: jest.fn(() => res) } as any)
            const next = jest.fn()

            await authMiddleware.use(req as any, res, next);
            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.send).toHaveBeenCalledWith('Invalid DID')
            expect(next).not.toHaveBeenCalled()
        });

        it('should return 401 if timestamp is invalid', async () => {
            await did.authenticate()
            const reqBody = {
                some: 'data',
                num: 53,
                did: did.id,
                iat: Date.now() - 1000 * 60 * 6
            } satisfies WithAuthData<{
                some: string;
                num: number;
            }>
            const jws = await did.createJWS(reqBody)
            const req: { body: DagJWS } = {
                body: jws
            }
            const res = jest.mocked<Response>({ status: jest.fn(() => res), send: jest.fn(() => res) } as any)
            const next = jest.fn()
            await authMiddleware.use(req as any, res, next);
            expect(res.status).toHaveBeenCalledWith(401)
            expect(res.send).toHaveBeenCalledWith('Invalid timestamp')
            expect(next).not.toHaveBeenCalled()
        })
    });
});