import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../../repositories/user/user.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { HiveModule } from '../../repositories/hive/hive.module';
import { EmailModule } from '../email/email.module';
import { LinkedAccountModule } from '../../repositories/linked-accounts/linked-account.module';
import { RequireHiveVerify } from './utils';

@Module({
  imports: [
    AuthModule,
    UserModule,
    HiveAccountModule,
    HiveModule,
    LinkedAccountModule,
    EmailModule,
  ],
  controllers: [ApiController, RequireHiveVerify],
  providers: [],
})
export class ApiModule {}
