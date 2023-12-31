import { Module } from '@nestjs/common';
import { AppService } from './app.services';
import { ApiModule, UsersModule } from './api.modules';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { LocalStrategy } from './auth/auth.strategy';
import { UploadController } from './uploader/upload.controller';
import { UserModule } from '../../repositories/user/user.module';

@Module({
  imports: [ AuthModule, UserModule, ApiModule, ],
  controllers: [ AppController, UploadController ],
  providers: [ AppService, AuthModule, LocalStrategy ],
})
export class AppModule {}   