import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import crypto from 'crypto';
import { HiveModule } from './hive.module';
import { HiveService } from './hive.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../../repositories/user/user.module';
import { LegacyUserRepository } from '../../repositories/user/user.repository';
import { LegacyHiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';

describe('AuthController', () => {
  let app: INestApplication

  let mongod: MongoMemoryServer;
  let hiveService: HiveService;
  let legacyUserRepository: LegacyUserRepository;
  let legacyHiveAccountRepository: LegacyHiveAccountRepository;

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
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: 'acela-core',
          dbName: 'acela-core',
        }),
        HiveAccountModule,
        HiveChainModule,
        HiveAccountModule,
        UserModule,
        HiveModule,
      ],
      controllers: [],
      providers: [HiveService]
    })
    class TestModule {}

    let moduleRef: TestingModule;

    moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    hiveService = moduleRef.get<HiveService>(HiveService);
    legacyUserRepository = moduleRef.get<LegacyUserRepository>(LegacyUserRepository)
    legacyHiveAccountRepository = moduleRef.get<LegacyHiveAccountRepository>(LegacyHiveAccountRepository)
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init()
  })

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('Create hive account', () => {
    it('Creates an account on the happy path', async () => {
      const sub = 'sad';
      const user = await legacyUserRepository.createNewSubUser({ sub, user_id: 'test_user_id' })
      const response = await hiveService.requestHiveAccount('madeupusername77', user!.user_id)
      
      expect(response).toEqual({
        block_num: 1,
        expired: false,
        id: "id",
        trx_num: 10,
      })
    })

    it('Fails when a user requests a second account', async () => {
      const sub = 'sad';
      const user = await legacyUserRepository.createNewSubUser({ sub, user_id: 'test_user_id' })
      await hiveService.requestHiveAccount('madeupusername21', user!.user_id)
      await expect(hiveService.requestHiveAccount('madeupusername77', user!.user_id)).rejects.toThrow('Http Exception');
    })
  })

  describe('Vote on a hive post', () => {
    it('Votes on a post when a hive user is logged in and the vote is authorised', async () => {
      const sub = 'singleton/sisygoboom/hive';
      const user = await legacyUserRepository.createNewSubUser({ sub, user_id: 'test_user_id' })
      await legacyHiveAccountRepository.insertCreated({ account: 'sisygoboom', user_id: user!._id })
      const response = await hiveService.vote({ votingAccount: 'sisygoboom', sub, user_id: user!._id, network: 'hive', author: 'ned', permlink: 'sa', weight: 10000 })
      
      expect(response).toEqual({
        block_num: 123456,
        expired: false,
        id: "mock_id",
        trx_num: 789,
      })
    });

    it('Fails when attempting to vote from a different hive account which has not been linked', async () => {
      const sub = 'singleton/username1/hive';
      const user = await legacyUserRepository.createNewSubUser({ sub, user_id: 'test_user_id' })
      await legacyHiveAccountRepository.insertCreated({ account: 'username1', user_id: user!._id })
      await expect(hiveService.vote({ votingAccount: 'username2', sub, network: 'hive', author: 'ned', user_id: user!._id, permlink: 'sa', weight: 10000 }))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('Votes on a post when a hive user is logged in and attepts to vote from a linked account', async () => {
      const sub = 'singleton/ned/hive'
      const user = await legacyUserRepository.createNewSubUser({ sub, user_id: 'test_user_id' });
      await hiveService.insertCreated('username2', user!._id);
      const response = await hiveService.vote({ votingAccount: 'username2', user_id: user!._id, sub, network: 'hive', author: 'ned', permlink: 'sa', weight: 10000 })
      
      expect(response).toEqual({
        block_num: 123456,
        expired: false,
        id: "mock_id",
        trx_num: 789,
      })
    });

    it('Throws an error when a vote weight is invalid', async () => {
      const sub = 'singleton/sisygoboom/hive';
      const user = await legacyUserRepository.createNewSubUser({ sub, user_id: 'test_user_id' });
      await expect(hiveService.vote({ votingAccount: 'sisygoboom', sub, network: 'hive', author: 'ned', user_id: user!._id, permlink: 'sa', weight: 10001 }))
      .rejects
      .toThrow();
      await expect(hiveService.vote({ votingAccount: 'sisygoboom', sub, network: 'hive', author: 'ned', user_id: user!._id, permlink: 'sa', weight: -10001 }))
      .rejects
      .toThrow();
    });
  })
});