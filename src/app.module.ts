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

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    MongooseModule.forRoot(`${(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017')}/threespeak${process.env.CORE_MONGODB_PARAMS}`, {
      connectionName: 'threespeak',
      autoIndex: true,
    }),
    MongooseModule.forRoot(`${(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017')}/3speakAuth${process.env.CORE_MONGODB_PARAMS}`, {
      connectionName: '3speakAuth'
    }),
    MongooseModule.forRoot(`${(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017')}/acela-core${process.env.CORE_MONGODB_PARAMS}`, {
      connectionName: 'acela-core'
    }),
    ScheduleModule.forRoot(),
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
    ApiModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
