import { Module } from '@nestjs/common';
import { AppService } from '../../app.services';
import { ApiModule, UsersModule } from './api.modules';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { LocalStrategy } from './auth/auth.strategy';

@Module({
  imports: [ AuthModule, UsersModule, ApiModule, ],
  controllers: [ AppController ],
  providers: [ AppService, AuthModule, LocalStrategy ],
})
export class AppModule {}   