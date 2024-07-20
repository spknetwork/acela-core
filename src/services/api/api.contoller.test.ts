import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { INestApplication, ValidationPipe, Module, CanActivate, ExecutionContext, CallHandler, Injectable } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AuthGuard } from '@nestjs/passport';
import { ApiController } from './api.controller';
import { ApiModule } from './api.module';
import { AuthService } from '../auth/auth.service';
import { LegacyHiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { LegacyUserRepository } from '../../repositories/user/user.repository';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import { EmailService } from '../email/email.service';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { UserModule } from '../../repositories/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { MockAuthGuard, MockDidUserDetailsInterceptor, UserDetailsInterceptor } from './utils';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { EmailModule } from '../email/email.module';
import * as crypto from 'crypto';
import { HiveModule } from '../hive/hive.module';
import { PrivateKey } from '@hiveio/dhive';
import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';

describe('ApiController', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let authService: AuthService;
  let hiveRepository: HiveChainRepository;
  let emailService: EmailService;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    process.env.JWT_PRIVATE_KEY = crypto.randomBytes(64).toString('hex');

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
          connectionName: 'acela-core',
          dbName: 'acela-core',
        }),
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: '3speakAuth',
          dbName: '3speakAuth',
        }),
        AuthModule,
        HiveModule,
        UserModule,
        UserAccountModule,
        HiveAccountModule,
        SessionModule,
        HiveChainModule,
        EmailModule,
        ApiModule,
        JwtModule.register({
          secretOrPrivateKey: process.env.JWT_PRIVATE_KEY,
          signOptions: { expiresIn: '30d' },
        }),
      ],
      controllers: [ApiController],
      providers: [AuthService],
      exports: [AuthService]
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideInterceptor(UserDetailsInterceptor)
      .useClass(MockDidUserDetailsInterceptor)
      .compile();

    authService = moduleRef.get<AuthService>(AuthService);
    hiveRepository = moduleRef.get<HiveChainRepository>(HiveChainRepository);
    emailService = moduleRef.get<EmailService>(EmailService);

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('/POST /v1/hive/post_comment', () => {
    it('should post a comment to HIVE blockchain', async () => {
      const jwtToken = 'test_jwt_token';
      const body = {
        author: 'test-account',
        body: 'Example body',
        parent_author: 'sagarkothari88',
        parent_permlink: 'actifit-sagarkothari88-20230211t122818265z',
      };

      return request(app.getHttpServer())
        .post('/v1/hive/post_comment')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(body)
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({
            block_num: 1,
           expired: false,
            id: 'test',
           trx_num: 8008135,
          })
        })
    });
  });

  describe('/POST /v1/hive/linkaccount', () => {
    it('should link a Hive account', async () => {
      const jwtToken = 'test_jwt_token';

      const user_id = 'test_user_id'
      const user = await authService.createDidUser('did:key:z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5#z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5', user_id)
      const hiveUsername = 'starkerz'

      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const publicKey = privateKey.createPublic();
      const publicKeyString = publicKey.toString();
      const message = `${user_id} is the owner of @${hiveUsername}`;
      const signature = privateKey.sign(crypto.createHash('sha256').update(message).digest());

      const body = { username: hiveUsername, proof: signature.toString() };

      process.env.TEST_PUBLIC_KEY = publicKeyString;

      return request(app.getHttpServer())
        .post('/v1/hive/linkaccount')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(body)
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({
            __v: 0,
            _id: expect.any(String),
            account: hiveUsername,
            user_id: user._id.toString(),
          });
        });
    });
  });

  describe('/GET /v1/profile', () => {
    it('should get the user profile', async () => {
      const jwtToken = 'test_jwt_token';

      return request(app.getHttpServer())
        .get('/v1/profile')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .then(response => {
          expect(response.body).toEqual({
            network: "did",
            sub: "singleton/did:key:z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5#z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5/did",
            type: "singleton",
            user_id: "test_user_id",
          });
        });
    });
  });

  describe('/GET /v1/hive/linked-account/list', () => {
    it('should list linked accounts', async () => {
      const jwtToken = 'test_jwt_token';

      // Mock linking and verifying an account
      const user = await authService.createDidUser('did:key:z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5#z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5', 'test_user_id')
      await authService.linkHiveAccount({ user_id: user._id, username: 'test-account' })
      await authService.linkHiveAccount({ user_id: user._id, username: 'joop' })

      return request(app.getHttpServer())
        .get('/v1/hive/linked-account/list')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .then(response => {
          expect(response.body).toEqual(
            {
              accounts: ['test-account', 'joop'],
            },
          );
        });
    });
  });
});
