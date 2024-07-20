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
import { MongoMemoryServer } from 'mongodb-memory-server';
import { INestApplication, Module } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import crypto from 'crypto';
import { HiveModule } from '../hive/hive.module';
import { LegacyUserRepository } from '../../repositories/user/user.repository';

describe('Auth Service', () => {
  let app: INestApplication
  let mongod: MongoMemoryServer;
  let authService: AuthService;
  let legacyUserRepository: LegacyUserRepository

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
    }).compile();
    authService = moduleRef.get<AuthService>(AuthService);
    legacyUserRepository = moduleRef.get<LegacyUserRepository>(LegacyUserRepository);
    app = moduleRef.createNestApplication();
    await app.init()
  })

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('Account Creation', () => {
    it('creates a Did account successfully', async () => {
      await authService.createDidUser('did:key:z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5#z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5', 'test_user_id')
      const exists = await authService.didUserExists('did:key:z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5#z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5')
      expect(exists).toBeTruthy()
    })

    it('Creates a hive account successfully', async () => {
      await authService.createHiveUser({ user_id: '1337', hiveAccount: 'sisygoboom' })
      const exists = await legacyUserRepository.findOneBySub('singleton/sisygoboom/hive')
      expect(exists).toBeTruthy()
    })
  })
});