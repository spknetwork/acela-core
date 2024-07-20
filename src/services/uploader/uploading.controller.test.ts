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
import { AuthGuard } from '@nestjs/passport';
import { UploadModule } from '../../repositories/upload/upload.module';
import { VideoModule } from '../../repositories/video/video.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { PublishingModule } from '../publishing/publishing.module';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import sharp from 'sharp';
import { JwtModule } from '@nestjs/jwt';
import crypto from 'crypto';
import { MockUserDetailsInterceptor, UserDetailsInterceptor } from '../api/utils';
import { HiveModule } from '../hive/hive.module';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { VideoRepository } from '../../repositories/video/video.repository';

describe('UploadingController', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let uploadingService: UploadingService;
  let authService: AuthService;
  let videoRepository: VideoRepository;

  beforeEach(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    process.env.JWT_PRIVATE_KEY = crypto.randomBytes(64).toString('hex');

    @Module({
      imports: [
        ConfigModule.forRoot(),
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
        VideoModule,
        HiveChainModule,
        AuthModule,
        HiveModule,
        UploadModule,
        IpfsModule,
        PublishingModule,
        JwtModule.register({
          secretOrPrivateKey: process.env.JWT_PRIVATE_KEY,
          signOptions: { expiresIn: '30d' },
        }),
        UploadingModule,
      ],
      controllers: [UploadingController],
      providers: [UploadingService, HiveChainRepository],
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
      .useClass(MockUserDetailsInterceptor)
      .compile();

    uploadingService = moduleRef.get<UploadingService>(UploadingService);
    authService = moduleRef.get<AuthService>(AuthService);
    videoRepository = moduleRef.get<VideoRepository>(VideoRepository);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await mongod.stop();
    await mongod.start();
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
        .set('x-user-type', 'hive')
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
      const didUser = await authService.createDidUser('singleton/starkerz/hive', 'test_id')
      await authService.linkHiveAccount({ user_id: didUser._id, username: 'sisygoboom' });
      const response = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'sisygoboom', user_id: didUser.user_id })
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

  describe('createUpload', () => {
    it('should create an video document', async () => {
      const didUser = await authService.createDidUser('singleton/starkerz/hive', 'test_id')
      await authService.linkHiveAccount({ user_id: didUser._id, username: 'sisygoboom' });
      const response = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'sisygoboom', user_id: didUser.user_id })
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

    it('Should encode successfully when logged in with a hive account', async () => {
      const jwtToken = 'test_jwt_token';

      const starkerzUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');
      //await authService.linkHiveAccount({ user_id: starkerzUser._id, username: 'sisygoboom' });

      const upload = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'starkerz', user_id: starkerzUser.user_id });

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-user-type', 'hive')
        .send({
          upload_id: upload.upload_id,
          video_id: upload.video_id,
          permlink: upload.permlink
        })
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({});
        });
    })

    it('Should encode successfully when requesting use of a linked hive account', async () => {
      const jwtToken = 'test_jwt_token';

      const starkerzUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');
      const nedUser = await authService.createDidUser('singleton/ned/hive', 'different_test_id')
      await authService.linkHiveAccount({ user_id: starkerzUser._id, username: 'sisygoboom' });
      await authService.linkHiveAccount({ user_id: nedUser._id, username: 'sisygoboom' });

      const upload = await uploadingService.createUpload({ sub: 'singleton/ned/hive', username: 'sisygoboom', user_id: nedUser.user_id });

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-user-type', 'hive')
        .send({ 
          username: 'sisygoboom',
          upload_id: upload.upload_id,
          video_id: upload.video_id,
          permlink: upload.permlink
        })
        .expect(201)
        .then(response => {
          expect(response.body).toEqual({});
        });
    })

    it('Should fail when requesting use of an unlinked hive account', async () => {
      const jwtToken = 'test_jwt_token';

      const starkerzUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');
      await authService.linkHiveAccount({ user_id: starkerzUser._id, username: 'sisygoboom' });

      const upload = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'sisygoboom', user_id: starkerzUser.user_id });

      await authService.unlinkHiveAccount({ user_id: starkerzUser._id, username: 'sisygoboom' })

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-user-type', 'hive')
        .send({ 
          username: 'sisygoboom',
          upload_id: upload.upload_id,
          video_id: upload.video_id,
          permlink: upload.permlink
        })
        .expect(401)
        .then(response => {
          expect(response.body).toEqual({
            error: "Unauthorized",
            message: "Hive account is not linked",
            statusCode: 401,
          });
        });
    })

    it('Should fail if the upload details are falsified', async () => {
      const jwtToken = 'test_jwt_token';

      const starkerzUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');
      await authService.linkHiveAccount({ user_id: starkerzUser._id, username: 'sisygoboom' });

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-user-type', 'hive')
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

      const starkerzUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');

      const upload = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'starkerz', user_id: starkerzUser.user_id });

      process.env.DELEGATED_ACCOUNT = 'threespeak'

      return request(app.getHttpServer())
        .post('/v1/upload/start_encode')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-user-type', 'hive')
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
            message: "Hive account is not linked",
            statusCode: 401,
          });
        });
    })

    describe('/POST upload/update_post', () => {
      it('should update the post successfully', async () => {
        const jwtToken = 'test_jwt_token';
        const didUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');
        await authService.linkHiveAccount({ user_id: didUser._id, username: 'sisygoboom' });
        const upload = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'sisygoboom', user_id: didUser.user_id });
  
        const updateData = {
          video_id: upload.video_id,
          title: 'Updated Title',
          body: 'Updated Body',
          owner: 'sisygoboom',
          beneficiaries: [],
          community: 'test-community',
          duration: 120,
          filename: 'updated-filename.mp4',
          language: 'en',
          originalFilename: 'original-filename.mp4',
          permlink: upload.permlink,
          size: 123456,
          tags: ['test', 'update'],
        };
  
        return request(app.getHttpServer())
          .post('/v1/upload/update_post')
          .set('Authorization', `Bearer ${jwtToken}`)
          .set('x-user-type', 'hive')
          .send(updateData)
          .expect(201)
          .then(async response => {
            expect(response.body).toEqual({});
            expect((await videoRepository.getVideoToPublish('sisygoboom', upload.permlink)).description).toEqual('Updated Body')
          });
      });
  
      it('should fail if the user does not have access to update the post', async () => {
        const jwtToken = 'test_jwt_token';
        const didUser = await authService.createDidUser('singleton/starkerz/hive', 'test_user_id');
        await authService.linkHiveAccount({ user_id: didUser._id, username: 'sisygoboom' });
        const response = await uploadingService.createUpload({ sub: 'singleton/starkerz/hive', username: 'sisygoboom', user_id: didUser.user_id });
  
        const updateData = {
          video_id: response.video_id,
          title: 'Updated Title',
          body: 'Updated Body',
          owner: 'other-user', // A different user
          beneficiaries: [],
          community: 'test-community',
          duration: 120,
          filename: 'updated-filename.mp4',
          language: 'en',
          originalFilename: 'original-filename.mp4',
          permlink: response.permlink,
          size: 123456,
          tags: ['test', 'update'],
        };
  
        return request(app.getHttpServer())
          .post('/v1/upload/update_post')
          .set('Authorization', `Bearer ${jwtToken}`)
          .set('x-user-type', 'hive')
          .send(updateData)
          .expect(401)
          .then(response => {
            expect(response.body).toEqual({
              statusCode: 401,
              message: 'Hive account is not linked',
              error: 'Unauthorized',
            });
          });
      });
  
      it('should fail if invalid data is provided', async () => {
        const jwtToken = 'test_jwt_token';
        const invalidUpdateData = {
          video_id: '',
          title: '',
          body: '',
          owner: '',
          beneficiaries: [],
          community: '',
          duration: -10,
          filename: '',
          language: '',
          originalFilename: '',
          permlink: '',
          size: -1,
          tags: [],
        };
  
        return request(app.getHttpServer())
          .post('/v1/upload/update_post')
          .set('Authorization', `Bearer ${jwtToken}`)
          .set('x-user-type', 'hive')
          .send(invalidUpdateData)
          .expect(400)
          .then(response => {
            expect(response.body).toEqual({
              statusCode: 400,
              message: expect.any(Array), // Assuming class-validator returns an array of errors
              error: 'Bad Request',
            });
          });
      });
    });
  })
