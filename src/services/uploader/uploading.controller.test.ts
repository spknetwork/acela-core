import 'dotenv/config';
import { UploadingController } from './uploading.controller';
import { UploadingService } from './uploading.service';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { UploadingModule } from './uploading.module';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AuthGuard } from '@nestjs/passport';
import { UploadModule } from '../../repositories/upload/upload.module';
import { VideoModule } from '../../repositories/video/video.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { PublishingModule } from '../publishing/publishing.module';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import sharp from 'sharp';
import { JwtModule } from '@nestjs/jwt';
import crypto from 'crypto';
import { MockHiveUserDetailsInterceptor, UserDetailsInterceptor } from '../api/utils';
import { HiveModule } from '../hive/hive.module';
import { LinkedAccountRepository } from '../../repositories/linked-accounts/linked-account.repository';

describe('UploadingController', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let uploadingService: UploadingService;
  let linkedAccountsRepository: LinkedAccountRepository;

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
        VideoModule,
        HiveChainModule,
        HiveModule,
        UploadModule,
        IpfsModule,
        PublishingModule,
        JwtModule.register({
          secretOrPrivateKey: process.env.JWT_PRIVATE_KEY,
          signOptions: { expiresIn: '30d' },
        }),
        UploadingModule
      ],
      controllers: [UploadingController],
      providers: [UploadingService, HiveChainRepository], // Ensure HiveRepository is provided if it's used in the service
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = { id: 'test_user_id' };
          return true;
        },
      })
      .overrideInterceptor(UserDetailsInterceptor)
      .useClass(MockHiveUserDetailsInterceptor)
      .compile();

    uploadingService = moduleRef.get<UploadingService>(UploadingService);
    linkedAccountsRepository = moduleRef.get<LinkedAccountRepository>(LinkedAccountRepository);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('/POST upload/thumbnail', () => {
    it('should upload a thumbnail and return CID', async () => {
      const jwtToken = 'test_jwt_token';
      const semiTransparentRedPng = await sharp({
        create: {
          width: 48,
          height: 48,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 }
        }
      })
        .png()
        .toBuffer();

      return request(app.getHttpServer())
        .post('/v1/upload/thumbnail')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('file', semiTransparentRedPng, 'test-image.png')
        .field('video_id', 'test_video_id')
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({
            status: 'ok',
            thumbnail_cid: 'mock-cid',
          });
        });
    });
  });

  describe('createUpload', () => {
    it('should create an upload document', async () => {
      const response = await uploadingService.createUpload({ sub: 'blah', username: 'foo', id: 'bar' })
      expect(response).toEqual({
        permlink: expect.any(String),
        upload_id: expect.any(String),
        video_id: expect.any(String)
      })

      const upload = await uploadingService.getUploadByUploadId(response.upload_id)

      expect(upload).toBeTruthy()

      const video = await uploadingService.getVideoByVideoId(response.video_id)

      expect(upload).toBeTruthy()
    });
  });

  describe('Start encode', () => {
    it('Should encode successfully', async () => {
      const jwtToken = 'test_jwt_token';

      await linkedAccountsRepository.linkHiveAccount('singleton/starkerz/hive', 'starkerz');

      const upload = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'starkerz', id: 'test_id' });

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ 
          username: 'starkerz',
          upload_id: upload.upload_id,
          video_id: upload.video_id,
          permlink: upload.permlink
        })
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({});
        });
    })

    it('Should fail if the upload details are falsified', async () => {
      const jwtToken = 'test_jwt_token';

      await linkedAccountsRepository.linkHiveAccount('singleton/starkerz/hive', 'sisygoboom');

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ 
          username: 'sisygoboom',
          upload_id: 'random',
          video_id: 'random',
          permlink: 'random'
        })
        .expect(400)
        .then(response => {
          expect(response.body).toEqual({
            error: "Bad Request",
            message: "No upload could be found matching that owner and permlink combination",
            statusCode: 400,
          });
        });
    })

    it('Should fail if the account is not linked', async () => {
      const jwtToken = 'test_jwt_token';

      const upload = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'starkerz', id: 'test_id' });

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ 
          username: 'ned',
          upload_id: upload.upload_id,
          video_id: upload.video_id,
          permlink: upload.permlink
        })
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            error: "Unauthorized",
            message: "Your account is not linked to the requested hive account",
            statusCode: 401,
          });
        });
    })
  })
});
