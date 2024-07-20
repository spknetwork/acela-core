import 'dotenv/config'
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../../repositories/user/user.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { INestApplication, Module } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import crypto from 'crypto';
import { LegacyUserSchema } from '../user/schemas/user.schema';
import { HiveAccountModule } from './hive-account.module';
import { LegacyHiveAccountRepository } from './hive-account.repository';
import { LegacyHiveAccountSchema } from './schemas/hive-account.schema';
import { LegacyUserRepository } from '../user/user.repository';

describe('Legacy hive account', () => {
  let app: INestApplication
  let mongod: MongoMemoryServer;
  let hiveAccountRepository: LegacyHiveAccountRepository;
  let legacyUserRepository: LegacyUserRepository;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create()
    const uri: string = mongod.getUri()

    process.env.JWT_PRIVATE_KEY = crypto.randomBytes(64).toString('hex');
    process.env.DELEGATED_ACCOUNT = 'threespeak';
    process.env.ACCOUNT_CREATOR = 'threespeak';

    @Module({
      imports: [
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: 'threespeak',
          dbName: 'threespeak',
          autoIndex: true,
        }),
        MongooseModule.forFeature([{ name: 'hiveaccounts', schema: LegacyHiveAccountSchema }], 'threespeak'),
        MongooseModule.forFeature([{ name: 'users', schema: LegacyUserSchema }], 'threespeak'),
        HiveAccountModule,
        UserModule
      ],
      controllers: [],
      providers: [LegacyHiveAccountRepository, LegacyUserRepository]
    })
    class TestModule {}

    let moduleRef: TestingModule;

    moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile()
    hiveAccountRepository = moduleRef.get<LegacyHiveAccountRepository>(LegacyHiveAccountRepository);
    legacyUserRepository = moduleRef.get<LegacyUserRepository>(LegacyUserRepository);
    app = moduleRef.createNestApplication();
    await app.init()
  })

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('User repository', () => {
    it(`Successfully creates a new user`, async () => {
      await legacyUserRepository.createNewSubUser({ sub: 'singleton/did/check', user_id: 'example' })
      const result = await legacyUserRepository.findOneBySub('singleton/did/check')
      expect(result).toBeTruthy()
    });
  })
});