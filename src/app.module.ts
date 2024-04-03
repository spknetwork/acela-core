import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksModule } from './services/tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VideoModule } from './repositories/video/video.module';
import { ConfigModule } from '@nestjs/config';
import { PublishingModule } from './services/publishing/publishing.module';
import { CreatorModule } from './repositories/creator/creator.module';
import { UserModule } from './repositories/user/user.module';
import { ApiModule } from './services/api/api.module';
import { AuthModule } from './services/auth/auth.module';
import { HiveModule } from './repositories/hive/hive.module';
import { DelegatedAuthorityModule } from './repositories/delegated-authority/delegated-auhthority.module';
import { HiveAccountModule } from './repositories/hive-account/hive-account.module';
import { LinkedAccountModule } from './repositories/linked-accounts/linked-account.module';
import { SessionModule } from './repositories/session/session.module';
import { UploadModule } from './repositories/upload/upload.module';
import { UserAccountModule } from './repositories/userAccount/user-account.module';
import { EmailModule } from './services/email/email.module';
import { UploadingModule } from './services/uploader/uploading.module';
import { IpfsModule } from './services/ipfs/ipfs.module';
import { LockModule } from './services/lock/lock.module';
import { VotingModule } from './services/voting/voting.module';

const mongoUrl = process.env.CORE_MONGODB_URL;

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    MongooseModule.forRoot(mongoUrl, {
      ssl: false,
      authSource: 'threespeak',
      readPreference: 'primary',
      connectionName: 'threespeak',
      dbName: 'threespeak',
      autoIndex: true
    }),
    MongooseModule.forRoot(mongoUrl, {
      ssl: false,
      authSource: 'threespeak',
      readPreference: 'primary',
      connectionName: '3speakAuth',
      dbName: '3speakAuth',
    }),
    MongooseModule.forRoot(mongoUrl, {
      ssl: false,
      authSource: 'threespeak',
      readPreference: 'primary',
      connectionName: 'acela-core',
      dbName: 'acela-core',
    }),
    ScheduleModule.forRoot(),
    LockModule,
    VideoModule,
    CreatorModule,
    UserModule,
    PublishingModule,
    AuthModule,
    TasksModule,
    HiveModule,
    IpfsModule,
    UploadingModule,
    DelegatedAuthorityModule,
    HiveAccountModule,
    LinkedAccountModule,
    SessionModule,
    UploadModule,
    EmailModule,
    UserAccountModule,
    ApiModule,
    VotingModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
