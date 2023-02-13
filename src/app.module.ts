import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.services';
import { UsersModule } from './users/users.module';
import { AuthModule } from './services/api/auth/auth.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [ AuthModule, UsersModule, ApiModule ],
  controllers: [ AppController ],
  providers: [ AppService, AuthModule ],
})
export class AppModule {}   