import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../../repositories/user/user.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { EmailModule } from '../email/email.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HiveModule } from '../hive/hive.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    HiveAccountModule,
    HiveChainModule,
    HiveModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secretOrPrivateKey: configService.get<string>('JWT_PRIVATE_KEY'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [ApiController],
  providers: [],
})
export class ApiModule {}
