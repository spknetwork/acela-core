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
import crypto from 'crypto';
import { PrivateKey } from '@hiveio/dhive';
import { AuthGuard } from '@nestjs/passport';
import { MockAuthGuard, MockDidUserDetailsInterceptor, UserDetailsInterceptor } from '../api/utils';
import { HiveService } from '../hive/hive.service';
import { HiveModule } from '../hive/hive.module';
import { LegacyUserRepository } from '../../repositories/user/user.repository';
import { EmailService } from '../email/email.service';
import { LegacyUserAccountRepository } from '../../repositories/userAccount/user-account.repository';
import * as jest from 'jest-mock'; // Import Jest mock

describe('AuthController', () => {
  let app: INestApplication;
  const seedBuf = new Uint8Array(32);
  seedBuf.fill(27);
  const key = new Ed25519Provider(seedBuf);
  const did = new DID({ provider: key, resolver: KeyResolver.getResolver() });
  let mongod: MongoMemoryServer;
  let authService: AuthService;
  let hiveService: HiveService;
  let userRepository: LegacyUserRepository;
  let emailService: EmailService;
  let userAccountRepository: LegacyUserAccountRepository;

  let verificationCode: string;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create();
    const uri: string = mongod.getUri();

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

    let moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).overrideGuard(AuthGuard('jwt'))
      .useClass(MockAuthGuard)
      .overrideInterceptor(UserDetailsInterceptor)
      .useClass(MockDidUserDetailsInterceptor)
      .compile();
    
    authService = moduleRef.get<AuthService>(AuthService);
    hiveService = moduleRef.get<HiveService>(HiveService);
    userRepository = moduleRef.get<LegacyUserRepository>(LegacyUserRepository);
    userAccountRepository = moduleRef.get<LegacyUserAccountRepository>(LegacyUserAccountRepository);
    emailService = moduleRef.get<EmailService>(EmailService);

    // Mocking the EmailService to capture the verification code
    jest.spyOn(emailService, 'sendRegistration').mockImplementation(async (email, code) => {
      verificationCode = code; // Store the verification code
      return;
    });

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

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

      await authService.createDidUser(did.id, 'test_user_id')

      return request(app.getHttpServer())
        .post('/v1/auth/login/singleton/did')
        .send(jws)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .expect(200)
        .then(async response => {
          expect(response.body).toHaveProperty('access_token');
          expect(typeof response.body.access_token).toBe('string');
          expect(await authService.didUserExists(did.id)).toBeTruthy();
          expect(await authService.getSessionByDid(did.id)).toBeTruthy();
        });
    });
  });

  describe('/POST /login', () => {
    it('Logs in successfully', async () => {

      const email = 'test@test.com';
      const password = 'testpass'

      await authService.registerEmailAndPasswordUser(email, password);
      await authService.verifyEmail(verificationCode); // Use the captured verification code
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          username: email,
          password: password
        })
        .expect(201)
        .then(async response => {
          expect(response.body).toEqual({
            access_token: expect.any(String)
          });
        });
    });

    it('Throws unauthorized when the password is wrong', async () => {

      const email = 'test@test.com';
      const password = 'testpass'

      await authService.registerEmailAndPasswordUser(email, password);
      await authService.verifyEmail(verificationCode);
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          username: email,
          password: password + 'im a hacker'
        })
        .expect(401)
        .then(async response => {
          expect(response.body).toEqual({
            error: "Unauthorized",
            message: "Email or password was incorrect or email has not been verified",
            statusCode: 401,
          });
        });
    });

    it('Throws when the email does not exist', async () => {

      const email = 'test@test.com';
      const password = 'testpass'

      await authService.registerEmailAndPasswordUser(email, password);
      await authService.verifyEmail(verificationCode);
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          username: 'different@email.com',
          password: password
        })
        .expect(401)
        .then(async response => {
          expect(response.body).toEqual({
            error: "Unauthorized",
            message: "Email or password was incorrect or email has not been verified",
            statusCode: 401,
          });
        });
    });

    it('Throws when the user has not verified their email', async () => {

      const email = 'test@test.com';
      const password = 'testpass'

      await authService.registerEmailAndPasswordUser(email, password);
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          username: email,
          password: password
        })
        .expect(401)
        .then(async response => {
          expect(response.body).toEqual({
            error: "Unauthorized",
            message: "Email or password was incorrect or email has not been verified",
            statusCode: 401,
          });
        });
    });
  })

  describe('/POST /request_hive_account', () => {
    it('creates a Hive account successfully', async () => {

      const hiveUsername = 'jimbob'

      const user = await authService.createDidUser('bob', 'test_user_id')
  
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/v1/auth/request_hive_account')
        .send({ username: hiveUsername })
        .set('Authorization', 'Bearer <your_mocked_jwt_token>')
        .expect(201)
        .then(async response => {
          expect(response.body).toEqual({
            block_num: 1,
            expired: false,
            id: "id",
            trx_num: 10,
          });
          
          expect(await hiveService.isHiveAccountLinked({ user_id: user._id, account: hiveUsername })).toBe(true)
        });
    });
  
    it('throws error when user has already created a Hive account', async () => {

      const username= 'yeet';
      const user = await authService.createDidUser('asdasdassaddg', 'test_user_id')
      await hiveService.requestHiveAccount('bob', user.user_id);
      // Make the request to the endpoint
      return request(app.getHttpServer())
        .post('/v1/auth/request_hive_account')
        .send({ username })
        .set('Authorization', 'Bearer <your_mocked_jwt_token>')
        .expect(400)
        .then(async response => {
          expect(response.body).toEqual({
            reason: "You have already linked a hive account, so cannot claim a free one.",
          });
          expect(await hiveService.isHiveAccountLinked({ account: 'bob', user_id: user._id })).toBe(true)
          expect(await hiveService.isHiveAccountLinked({ account: username, user_id: user._id })).toBe(false)
        });
      });
  });

  describe('/POST register', () => {
    it('registers a new user successfully with valid email', async () => {
      const email = 'test@invalid.example.org';
      const password = '!SUPER-SECRET_password!7';

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password })
        .expect(201);

      expect(response.body).toEqual({ access_token: expect.any(String) });

      const user = await userRepository.findOneByEmail(email);
      expect(user).toBeDefined();
    });

    it('throws error when email is already registered', async () => {
      const email = 'test@invalid.example.org';
      const password = '!SUPER-SECRET_password!7';
      
      // Create a user with the same email
      await authService.registerEmailAndPasswordUser(email, password);

      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password })
        .expect(400)
        .then(response => {
          expect(response.body).toEqual({ reason: 'Email Password account already created!' });
        });
    });

    it('throws error when email is invalid', async () => {
      const email = 'tesnvalid.example.org';
      const password = '!SUPER-SECRET_password!7';

      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password })
        .expect(400)
        .then(response => {
          expect(response.body).toEqual({
            error: "Bad Request",
            message: [
              "Email must be a valid email address",
              "email must be an email",
            ],
            statusCode: 400
          });
        });
    });

    it('throws error when password is not strong enough', async () => {
      const email = 'test@invalid.example.org';
      const password = '!SUPER-SECRET_password!';

      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email, password })
        .expect(400)
        .then(response => {
          expect(response.body).toEqual({
            error: "Bad Request",
            message: [
              "password is not strong enough",
            ],
            statusCode: 400
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
        .post('/v1/auth/login/singleton/hive')
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
        .post('/v1/auth/login/singleton/hive')
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
        .post('/v1/auth/login/singleton/hive')
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
        .post('/v1/auth/login/singleton/hive')
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
        .post('/v1/auth/login/singleton/hive')
        .send(body)
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            error: "Unauthorized",
            message: "The message did not match the signature",
            statusCode: 401,
          })
        })
      })
    })
  })
});