import { Module } from '@nestjs/common';
import { AppService } from './app.services';
import { ApiModule, UsersModule } from './api.modules';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { LocalStrategy } from './auth/auth.strategy';
import { UploadController } from './uploader/upload.controller';
import { HiveuserModule } from './hiveuser/hiveuser.module';
import { TrustedclientsModule } from './trustedclients/trustedclients.module';

@Module({
  imports: [ AuthModule, UsersModule, ApiModule, HiveuserModule, TrustedclientsModule],
  controllers: [ AppController, UploadController ],
  providers: [ AppService, AuthModule, LocalStrategy ],
})
export class AppModule {}   