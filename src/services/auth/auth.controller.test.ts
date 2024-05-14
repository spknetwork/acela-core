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
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import * as KeyResolver from 'key-did-resolver';
import { TestingModule } from '@nestjs/testing';

describe('AuthController', () => {
  let app: INestApplication;
  const seedBuf = new Uint8Array(32);
  seedBuf.fill(27);
  const key = new Ed25519Provider(seedBuf)
  const did = new DID({ provider: key, resolver: KeyResolver.getResolver() })
  let mongod;
  let authService: AuthService;


  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    @Module({
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
        JwtModule.register({
          secretOrPrivateKey: 'ac746c4dc9faf199d7fec029f1e8646c08da3698d9c95b931a1df2ceb666e336dbdacf46763a89777206cf48fc43be42cbe0f988e4bd4a10e7610173d29310ea987d93bae49f6391b91a5338cffbf2389797d7217903b2db1cbf983632f64e088fb515537262d2475589370fc1f5aa7820c34f0f5523fb88f75dace392d22caf',
          signOptions: { expiresIn: '30d' },
        }),
        HiveModule,
        EmailModule,
        AuthModule
      ],
      controllers: [AuthController],
      providers: [AuthService]
    })
    class TestModule {}

    let moduleRef: TestingModule;

    moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    authService = moduleRef.get<AuthService>(AuthService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init()
  });

  describe('Login using did', () => {

    it(`/POST login singleton`, async () => {
      await did.authenticate()

      // Correctly prepare the payload and sign the JWT
      const payload = {
        sub: "1234567890",
        name: "John Doe",
        iat: Date.now(),
        did: did.id
      };

      const jws = await did.createJWS(payload);

      console.log(jws)

      return request(app.getHttpServer())
        .post('/api/v1/auth/login_singleton/did')
        .send(jws)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .expect(200)
        .then(response => {
          expect(response.body).toHaveProperty('access_token');
          expect(typeof response.body.access_token).toBe('string');
          expect(authService.didUserExists(did.id)).toBeTruthy();
          expect(authService.getSessionByDid(did.id)).toBeTruthy();
        });
    });
  });
});