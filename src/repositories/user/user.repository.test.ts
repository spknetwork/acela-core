import 'dotenv/config'
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from '../../repositories/user/user.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { INestApplication, Module } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import crypto from 'crypto';
import { LegacyUserRepository } from './user.repository';
import { LegacyUserSchema } from './schemas/user.schema';
import { HiveAccountModule } from '../hive-account/hive-account.module';
import { LegacyHiveAccountRepository } from '../hive-account/hive-account.repository';
import { LegacyHiveAccountSchema } from '../hive-account/schemas/hive-account.schema';

describe('User repository', () => {
  let app: INestApplication
  let mongod: MongoMemoryServer;
  let userRepository: LegacyUserRepository;
  let hiveAccount: LegacyHiveAccountRepository;


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
        MongooseModule.forFeature([{ name: 'users', schema: LegacyUserSchema }], 'threespeak'),
        MongooseModule.forFeature([{ name: 'hiveaccounts', schema: LegacyHiveAccountSchema }], 'threespeak'),
        UserModule,
        HiveAccountModule
      ],
      controllers: [],
      providers: [LegacyUserRepository, LegacyHiveAccountRepository]
    })
    class TestModule {}

    let moduleRef: TestingModule;

    moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile()
    userRepository = moduleRef.get<LegacyUserRepository>(LegacyUserRepository);
    hiveAccount = moduleRef.get<LegacyHiveAccountRepository>(LegacyHiveAccountRepository);
    app = moduleRef.createNestApplication();
    await app.init()
  })

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });
  it(`Successfully creates a new user`, async () => {
    await userRepository.createNewSubUser({ sub: 'singleton/did/check', user_id: 'example' })
    const result = await userRepository.findOneBySub('singleton/did/check')
    expect(result).toBeTruthy()
  });

  it('Successfully gets legacy linked hive accounts', async () => {
    const user = await userRepository.createNewSubUser({ sub: 'singleton/sisy/hive', user_id: 'example' });
    if (!user?.user_id) throw new Error('No user id');
    
    await hiveAccount.insertCreated({ account: 'sisygoboom', user_id: user._id });

    await hiveAccount.insertCreated({ account: 'dave', user_id: user._id });
    
    const result = await userRepository.getLegacyLinkedHiveAccounts(user.user_id);
    
    expect(result).toMatchObject(
      {
        banned: false,
        linked_hiveaccounts: [
          "sisygoboom",
          "dave",
        ],
        user_id: user.user_id,
        _id: user._id
      }
    );
  });
});