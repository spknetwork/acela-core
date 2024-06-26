import 'dotenv/config'
import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
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
import crypto from 'crypto';
import { PrivateKey } from '@hiveio/dhive';
import { AuthGuard } from '@nestjs/passport';
import { MockAuthGuard, MockUserDetailsInterceptor, UserDetailsInterceptor } from '../api/utils';
import { HiveService } from '../hive/hive.service';
import { HiveModule } from '../hive/hive.module';

describe('AuthController', () => {
  let app: INestApplication
  const seedBuf = new Uint8Array(32)
  seedBuf.fill(27)
  const key = new Ed25519Provider(seedBuf)
  const did = new DID({ provider: key, resolver: KeyResolver.getResolver() })
  let mongod: MongoMemoryServer;
  let authService: AuthService;
  let hiveService: HiveService;


  beforeEach(async () => {
    mongod = await MongoMemoryServer.create()
    const uri: string = mongod.getUri()

    process.env.JWT_PRIVATE_KEY = crypto.randomBytes(64).toString('hex');
    process.env.DELEGATED_ACCOUNT = 'threespeak';
    process.env.ACCOUNT_CREATOR = 'threespeak';

    @Module({
      imports: [
        ConfigModule,
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: 'threespeak',
          dbName: 'threespeak',
          autoIndex: true,
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
          secretOrPrivateKey: process.env.JWT_PRIVATE_KEY,
          signOptions: { expiresIn: '30d' },
        }),
        HiveChainModule,
        EmailModule,
        AuthModule,
        HiveModule
      ],
      controllers: [AuthController],
      providers: [AuthService]
    })
    class TestModule {}

    let moduleRef: TestingModule;

    moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideInterceptor(UserDetailsInterceptor)
      .useClass(MockUserDetailsInterceptor)
      .compile();
    authService = moduleRef.get<AuthService>(AuthService);
    hiveService = moduleRef.get<HiveService>(HiveService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init()
  })

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('/POST login singleton did', () => {
    it(`Logs in successfully on the happy path`, async () => {
      await did.authenticate()

      // Correctly prepare the payload and sign the JWT
      const payload = {
        sub: "1234567890",
        name: "John Doe",
        iat: Date.now(),
        did: did.id
      };

      const jws = await did.createJWS(payload);

      return request(app.getHttpServer())
        .post('/api/v1/auth/login/singleton/did')
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

  describe('/POST /request_hive_account', () => {
    it('creates a Hive account successfully', async () => {
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/api/v1/auth/request_hive_account')
        .send({ username: 'test_user_id' })
        .set('Authorization', 'Bearer <your_mocked_jwt_token>')
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({
            block_num: 1,
            expired: false,
            id: "id",
            trx_num: 10,
          });
        });
    });
  
    it('throws error when user has already created a Hive account', async () => {

      await hiveService.requestHiveAccount('yeet', 'test_user_id')
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/api/v1/auth/request_hive_account')
        .send({ username: 'yeet' })
        .set('Authorization', 'Bearer <your_mocked_jwt_token>')
        .expect(400)
        .then(response => {
          expect(response.body).toEqual({
            reason: "You have already created the maximum of 1 free Hive account",
          });
        });
    });
  });
  

  describe('/POST login_singleton_hive', () => {
    it('Logs in sucessfully on the happy path', async () => {
      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const message = { account: 'sisygoboom', ts: Date.now() };
      const signature = privateKey.sign(crypto.createHash('sha256').update(JSON.stringify(message)).digest());

      process.env.TEST_PUBLIC_KEY = privateKey.createPublic().toString();

      const body = {
        authority_type: 'posting',
        proof_payload: message,
        proof: signature.toString(),
      }

      return request(app.getHttpServer())
        .post('/api/v1/auth/login/singleton/hive')
        .send(body)
        .expect(201)
        .then(response => {
          expect(response.body).toHaveProperty('access_token');
          expect(typeof response.body.access_token).toBe('string');
        })
    })

    it('Fails to log in when the user does not have posting authority', async () => {
      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const message = { account: 'ned', ts: Date.now() };
      const signature = privateKey.sign(crypto.createHash('sha256').update(JSON.stringify(message)).digest());

      process.env.TEST_PUBLIC_KEY = privateKey.createPublic().toString();

      const body = {
        authority_type: 'posting',
        proof_payload: message,
        proof: signature.toString(),
      }

      return request(app.getHttpServer())
        .post('/api/v1/auth/login/singleton/hive')
        .send(body)
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            errorType: "MISSING_POSTING_AUTHORITY",
            reason: "Hive Account @ned has not granted posting authority to @threespeak"
          })
        })
    })

    it('Fails to log in when the proof is out of date', async () => {
      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const message = { account: 'starkerz', ts: 1984 };
      const signature = privateKey.sign(crypto.createHash('sha256').update(JSON.stringify(message)).digest());

      process.env.TEST_PUBLIC_KEY = privateKey.createPublic().toString();

      const body = {
        authority_type: 'posting',
        proof_payload: message,
        proof: signature.toString(),
      }

      return request(app.getHttpServer())
        .post('/api/v1/auth/login/singleton/hive')
        .send(body)
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            errorType: "INVALID_SIGNATURE",
            reason: "Invalid Signature",
          })
        })
    })

    it('Fails to log in when the proof is in the future', async () => {
      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const message = { account: 'starkerz', ts: Date.now() + 30000 };
      const signature = privateKey.sign(crypto.createHash('sha256').update(JSON.stringify(message)).digest());

      process.env.TEST_PUBLIC_KEY = privateKey.createPublic().toString();

      const body = {
        authority_type: 'posting',
        proof_payload: message,
        proof: signature.toString(),
      }

      return request(app.getHttpServer())
        .post('/api/v1/auth/login/singleton/hive')
        .send(body)
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            errorType: "INVALID_SIGNATURE",
            reason: "Invalid Signature",
          })
        })
    })

    it('Fails to log in when the proof is from the wrong account', async () => {
      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const message = { account: 'starkerz', ts: Date.now() };
      const signature = privateKey.sign(crypto.createHash('sha256').update(JSON.stringify(message)).digest());

      const body = {
        authority_type: 'posting',
        proof_payload: message,
        proof: signature.toString(),
      }

      return request(app.getHttpServer())
        .post('/api/v1/auth/login/singleton/hive')
        .send(body)
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            errorType: "INVALID_SIGNATURE",
            reason: "Invalid Signature",
          })
        })
    })
  })
});