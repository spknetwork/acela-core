import 'dotenv/config';
import { UploadingController } from './uploading.controller';
import { UploadingService } from './uploading.service';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HiveModule } from '../../repositories/hive/hive.module';
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
import { HiveRepository } from '../../repositories/hive/hive.repository';
import sharp from 'sharp';
import { JwtModule } from '@nestjs/jwt';
import crypto from 'crypto';

describe('UploadingController', () => {
  let app: INestApplication;
  let mongod;
  let uploadingService: UploadingService;

  beforeAll(async () => {
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
        HiveModule,
        UploadModule,
        IpfsModule,
        PublishingModule,
        JwtModule.register({
          secretOrPrivateKey: 'ac746c4dc9faf199d7fec029f1e8646c08da3698d9c95b931a1df2ceb666e336dbdacf46763a89777206cf48fc43be42cbe0f988e4bd4a10e7610173d29310ea987d93bae49f6391b91a5338cffbf2389797d7217903b2db1cbf983632f64e088fb515537262d2475589370fc1f5aa7820c34f0f5523fb88f75dace392d22caf',
          signOptions: { expiresIn: '30d' },
        }),
        UploadingModule
      ],
      controllers: [UploadingController],
      providers: [UploadingService, HiveRepository], // Ensure HiveRepository is provided if it's used in the service
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
      .compile();

    uploadingService = moduleRef.get<UploadingService>(UploadingService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
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
        .post('/api/v1/upload/thumbnail')
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
});
