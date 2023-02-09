import { Module } from '@nestjs/common';
import { ApiService, UsersService } from './api.services';

@Module({
  providers: [ApiService]
})
export class ApiModule {}

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}