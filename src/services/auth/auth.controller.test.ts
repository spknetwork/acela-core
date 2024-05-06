import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HiveModule } from '../../repositories/hive/hive.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from './auth.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { UserModule } from '../../repositories/user/user.module';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { DID } from 'dids';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import { INestApplication } from '@nestjs/common';
import { AuthMiddleware } from './auth.middleware';
import * as KeyResolver from 'key-did-resolver'

describe('AuthController', () => {
  let authController: AuthController;
  let app: INestApplication;
  let authMiddleware: AuthMiddleware
  const seedBuf = new Uint8Array(32);
  seedBuf.fill(27);
  const key = new Ed25519Provider(seedBuf)
  const did = new DID({ provider: key, resolver: KeyResolver.getResolver() })
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: 'threespeak',
          dbName: 'threespeak',
          autoIndex: true
        }),
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: '3speakAuth',
          dbName: '3speakAuth',
        }),
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: 'acela-core',
          dbName: 'acela-core',
        }),
        UserAccountModule, 
        SessionModule,
        HiveAccountModule,
        UserModule,
        JwtModule,
        HiveModule,
        EmailModule,
        AuthModule
      ],
      controllers: [AuthController],
      providers: [AuthService]
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  });

  describe('Login using did', () => {

    it(`/POST login singleton`, async () => {
      await did.authenticate()

      // Correctly prepare the payload and sign the JWT
      const payload = {
        sub: "1234567890",
        name: "John Doe",
        iat: 1516239022,
        did: did.id
      };

      const jws = await did.createJWS(payload);

      return request(app.getHttpServer())
        .post('/api/v1/auth/login_singleton/did')
        .send(jws)
        .expect(200)
        .expect({});
    });
  });
});