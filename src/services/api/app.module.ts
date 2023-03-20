import { Module } from '@nestjs/common';
import { AppService } from './app.services';
import { ApiModule, UsersModule } from './api.modules';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { LocalStrategy } from './auth/auth.strategy';
import { UploadController } from './uploader/upload.controller';
import { HiveuserModule } from './hiveuser/hiveuser.module';
import { HiveauthuserController } from './hiveauthuser/hiveauthuser.controller';
import { HiveuserService } from './hiveuser/hiveuser.service'
import { HiveauthuserModule } from './hiveauthuser/hiveauthuser.module';
import { HiveauthuserService } from './hiveauthuser/hiveauthuser.service';
import { HiveuserController } from './hiveuser/hiveuser.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ AuthModule, UsersModule, ApiModule, HiveauthuserModule, HiveuserModule],
  controllers: [ AppController, UploadController, HiveuserController, HiveauthuserController ],
  providers: [ JwtService, AppService, AuthModule, LocalStrategy, HiveuserService, HiveauthuserService ],
})
export class AppModule {}   