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
import { HiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { UserRepository } from '../../repositories/user/user.repository';
import { HiveRepository } from '../../repositories/hive/hive.repository';
import { LinkedAccountRepository } from '../../repositories/linked-accounts/linked-account.repository';
import { EmailService } from '../email/email.service';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { UserModule } from '../../repositories/user/user.module';
import { LinkedAccountModule } from '../../repositories/linked-accounts/linked-account.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { MockAuthGuard, MockUserDetailsInterceptor, UserDetailsInterceptor } from './utils';
import { HiveModule } from '../../repositories/hive/hive.module';
import { EmailModule } from '../email/email.module';

describe('ApiController', () => {
  let app: INestApplication;
  let mongod;
  let authService: AuthService;
  let hiveAccountRepository: HiveAccountRepository;
  let userRepository: UserRepository;
  let hiveRepository: HiveRepository;
  let linkedAccountsRepository: LinkedAccountRepository;
  let emailService: EmailService;

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
        HiveAccountModule,
        UserModule,
        AuthModule,
        EmailModule,
        HiveModule,
        ApiModule,
        JwtModule.register({
          secret: 'ac746c4dc9faf199d7fec029f1e8646c08da3698d9c95b931a1df2ceb666e336dbdacf46763a89777206cf48fc43be42cbe0f988e4bd4a10e7610173d29310ea987d93bae49f6391b91a5338cffbf2389797d7217903b2db1cbf983632f64e088fb515537262d2475589370fc1f5aa7820c34f0f5523fb88f75dace392d22caf',
          signOptions: { expiresIn: '30d' },
        }),
        LinkedAccountModule
      ],
      controllers: [ApiController],
      providers: [],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideInterceptor(UserDetailsInterceptor)
      .useClass(MockUserDetailsInterceptor)
      .compile();

    authService = moduleRef.get<AuthService>(AuthService);
    hiveAccountRepository = moduleRef.get<HiveAccountRepository>(HiveAccountRepository);
    userRepository = moduleRef.get<UserRepository>(UserRepository);
    hiveRepository = moduleRef.get<HiveRepository>(HiveRepository);
    linkedAccountsRepository = moduleRef.get<LinkedAccountRepository>(LinkedAccountRepository);
    emailService = moduleRef.get<EmailService>(EmailService);

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('/POST /api/v1/hive/post_comment', () => {
    it('should post a comment to HIVE blockchain', async () => {
      const jwtToken = 'test_jwt_token';
      const body = {
        author: 'test-account',
        body: 'Example body',
        parent_author: 'sagarkothari88',
        parent_permlink: 'actifit-sagarkothari88-20230211t122818265z',
      };

      return request(app.getHttpServer())
        .post('/api/v1/hive/post_comment')
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

  describe('/POST /api/v1/hive/linkaccount', () => {
    it('should link a Hive account', async () => {
      const jwtToken = 'test_jwt_token';
      const body = { username: 'test-account' };

      return request(app.getHttpServer())
        .post('/api/v1/hive/linkaccount')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(body)
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({
            challenge: expect.any(String),
          });
        });
    });
  });

  describe('/GET /api/v1/profile', () => {
    it('should get the user profile', async () => {
      const jwtToken = 'test_jwt_token';

      return request(app.getHttpServer())
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .then(response => {
          expect(response.body).toEqual({
            id: 'test_user_id',
            user_id: 'test_user_id'
          });
        });
    });
  });

  describe('/GET /api/v1/hive/linked-account/list', () => {
    it('should list linked accounts', async () => {
      const jwtToken = 'test_jwt_token';

      // Mock linking and verifying an account
      const link = await linkedAccountsRepository.linkHiveAccount('singleton/bob/did', 'test-account', 'challenge');
      await linkedAccountsRepository.verify(link._id);

      return request(app.getHttpServer())
        .get('/api/v1/hive/linked-account/list')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .then(response => {
          expect(response.body).toEqual(
            {
              accounts: ['test-account'],
            },
          );
        });
    });
  });
});
