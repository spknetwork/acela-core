import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import crypto from 'crypto';
import { MockUserDetailsInterceptor, UserDetailsInterceptor } from '../api/utils';
import { AuthService } from '../auth/auth.service';
import { VideoRepository } from '../../repositories/video/video.repository';
import { PublishingModule } from './publishing.module';
import { PublishingService } from './publishing.service';
import { VideoModule } from '../../repositories/video/video.module';
import { CreatorModule } from '../../repositories/creator/creator.module';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { AuthModule } from '../auth/auth.module';
import { UploadingService } from '../uploader/uploading.service';
import { UploadingModule } from '../uploader/uploading.module';
import request from 'supertest';
import { UploadingController } from '../uploader/uploading.controller';
import { response } from 'express';
import { HiveModule } from '../hive/hive.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { UploadModule } from '../../repositories/upload/upload.module';

describe('PublishingController', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let publishingService: PublishingService;
  let authService: AuthService;
  let videoRepository: VideoRepository;
  let uploadService: UploadingService;

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
          connectionName: 'acela-core',
          dbName: 'acela-core',
        }),
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: 'threespeak',
          dbName: 'threespeak',
        }),
        MongooseModule.forRoot(uri, {
          ssl: false,
          authSource: 'threespeak',
          readPreference: 'primary',
          connectionName: '3speakAuth',
          dbName: '3speakAuth',
        }),
        PublishingModule,
        VideoModule,
        UploadModule,
        UploadingModule,
        AuthModule,
        HiveChainModule,
        CreatorModule,
        HiveModule,
        IpfsModule,
        VideoModule,

      ],
      controllers: [UploadingController],
      providers: [UploadingService, PublishingService],
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

    publishingService = moduleRef.get<PublishingService>(PublishingService);
    authService = moduleRef.get<AuthService>(AuthService);
    videoRepository = moduleRef.get<VideoRepository>(VideoRepository);
    uploadService = moduleRef.get<UploadingService>(UploadingService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await mongod.stop();
    await mongod.start();
  });

  describe('Regular publish', () => {
    it('Publishes an encoded video', async () => {
      const user = await authService.createDidUser('bob', 'test_user_id');
      await authService.linkHiveAccount({ user_id: user._id, username: 'tim' });

      const response = await request(app.getHttpServer())
        .get('/v1/upload/create_upload')
        .set('Authorization', `Bearer junk`)
        .send({ username: 'tim' });

      expect(response.status).toBe(200); // Ensure the request was successful
      const responseBody = response.body;

      console.log(responseBody); // Log the response to see its structure

      const updateData = {
        video_id: responseBody.video_id,
        title: 'Updated Title',
        body: 'Updated Body',
        owner: 'tim',
        beneficiaries: [],
        community: 'test-community',
        duration: 120,
        filename: 'updated-filename.mp4',
        language: 'en',
        originalFilename: 'original-filename.mp4',
        permlink: responseBody.permlink,
        size: 123456,
        tags: ['test', 'update'],
      };

      const updateResponse = await request(app.getHttpServer())
        .post('/v1/upload/update_post')
        .set('Authorization', `Bearer hgfh`)
        .set('x-user-type', 'hive')
        .send(updateData);

      expect(updateResponse.body).toEqual({})
      expect(updateResponse.status).toBe(201);
    });
  });

  describe('Error publish', () => {
    it('Only gets videos with an error status', async () => {
      const lowRcVideo = await videoRepository.createNewHiveVideoPost({
        created_by: 'singleton/bob/did',
        owner: 'tim',
        title: 'How to count to 10',
        description: '1,2,3,4,5,6,7,8,9,10',
        tags: ['counting'],
        community: 'hive-123',
        beneficiaries: []
      });

      const publishFailedVideo = await videoRepository.createNewHiveVideoPost({
        created_by: 'singleton/bob/did',
        owner: 'tim',
        title: 'How to count to 10',
        description: '1,2,3,4,5,6,7,8,9,10',
        tags: ['counting'],
        community: 'hive-123',
        beneficiaries: []
      });

      const dualErrorVideo = await videoRepository.createNewHiveVideoPost({
        created_by: 'singleton/bob/did',
        owner: 'tim',
        title: 'How to count to 10',
        description: '1,2,3,4,5,6,7,8,9,10',
        tags: ['counting'],
        community: 'hive-123',
        beneficiaries: []
      });
  
      await videoRepository.createNewHiveVideoPost({
        created_by: 'singleton/bob/did',
        owner: 'tim',
        title: 'How to count to 10',
        description: '1,2,3,4,5,6,7,8,9,10',
        tags: ['counting'],
        community: 'hive-123',
        beneficiaries: []
      });
  
      await videoRepository.updateVideoFailureStatus({ owner: 'tim', permlink: lowRcVideo.permlink }, { lowRc: true, publishFailed: false });
      await videoRepository.updateVideoFailureStatus({ owner: 'tim', permlink: publishFailedVideo.permlink }, { lowRc: false, publishFailed: true });
      await videoRepository.updateVideoFailureStatus({ owner: 'tim', permlink: dualErrorVideo.permlink }, { lowRc: true, publishFailed: true });
  
      const videos = await videoRepository.getErrorVideosToPublish();
      expect(videos.length).toEqual(3);
    });
  });

  describe('Scheduled publish', () => {
    it('Only gets videos which are due to be published', async () => {
      await videoRepository.createNewHiveVideoPost({
        created_by: 'singleton/bob/did',
        owner: 'tim',
        title: 'How to count to 10',
        description: '1,2,3,4,5,6,7,8,9,10',
        tags: ['counting'],
        community: 'hive-123',
        beneficiaries: []
      });

      const user = await authService.createDidUser('did:dsiah', 'user_id');
      await authService.linkHiveAccount({ user_id: user._id, username: 'tim' });

      // This video is due to be published in 1 seconds, it hasn't been encoded yet but that's fine because it has mp4 source
      const { video_id } = await uploadService.createUpload({
        sub: user.sub,
        username: 'tim',
        user_id: 'user_id'
      });

      await uploadService.postUpdate({ video_id }, {
        beneficiaries: [],
        community: 'hive-123',
        body: 'body',
        duration: 123,
        filename: 'video.mp4',
        originalFilename: 'MOV_1234.mp4',
        size: 42,
        tags: ['day'],
        title: 'my day',
        publish_date: new Date((new Date().setSeconds(new Date().getSeconds() + 1))).toISOString(),
      });

      // This video is due to be published but the filetype isn't mp4 and encoding hasn't started
      const { video_id: video_id_2 } = await uploadService.createUpload({
        sub: user.sub,
        username: 'tim',
        user_id: 'user_id'
      });

      await uploadService.postUpdate({ video_id: video_id_2 }, {
        beneficiaries: [],
        community: 'hive-123',
        body: 'body',
        duration: 123,
        filename: 'video.flv',
        originalFilename: 'MOV_1234.flv',
        size: 42,
        tags: ['day'],
        title: 'my day',
        publish_date: new Date((new Date().setSeconds(new Date().getSeconds() + 1))).toISOString(),
      });

      // Helper function to introduce a delay
      function delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      // Wait for a few seconds before calling the getScheduledVideosToPublish
      await delay(1200); // wait for >2 seconds to ensure the publish_date has passed

      const videos = await videoRepository.getScheduledVideosToPublish();
      expect(videos.length).toEqual(1);
    });

    it('Does not get videos with invalid file types or not yet encoded', async () => {
      const user = await authService.createDidUser('did:dsiah', 'user_id');
      await authService.linkHiveAccount({ user_id: user._id, username: 'tim' });

      // This video is due to be published but the filetype isn't mp4 and encoding hasn't started
      const { video_id: video_id_2 } = await uploadService.createUpload({
        sub: user.sub,
        username: 'tim',
        user_id: 'user_id'
      });

      await uploadService.postUpdate({ video_id: video_id_2 }, {
        beneficiaries: [],
        community: 'hive-123',
        body: 'body',
        duration: 123,
        filename: 'video.flv',
        originalFilename: 'MOV_1234.flv',
        size: 42,
        tags: ['day'],
        title: 'my day',
        publish_date: new Date((new Date().setSeconds(new Date().getSeconds() + 2))).toISOString(),
      });

      const videos = await videoRepository.getScheduledVideosToPublish();
      expect(videos.length).toEqual(0);
    });

    it('Gets videos that are due to be published in the past', async () => {
      const user = await authService.createDidUser('did:dsiah', 'user_id');
      await authService.linkHiveAccount({ user_id: user._id, username: 'tim' });

      // This video is due to be published in the past
      const { video_id: video_id_3 } = await uploadService.createUpload({
        sub: user.sub,
        username: 'tim',
        user_id: 'user_id'
      });

      await videoRepository.updateHiveVideoPost({ video_id: video_id_3 }, {
        beneficiaries: [],
        community: 'hive-123',
        description: 'body',
        duration: 123,
        filename: 'video.m3u8',
        originalFilename: 'MOV_1234.m3u8',
        size: 42,
        tags: ['day'],
        title: 'my day',
        publish_date: new Date((new Date().setSeconds(new Date().getSeconds() - 100))),
      });

      const videos = await videoRepository.getScheduledVideosToPublish();
      expect(videos.length).toEqual(1);
    });
  });
});
