import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy, LocalStrategy } from './auth.strategy';
import { UserModule } from '../../repositories/user/user.module';
import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';
import { AuthController } from './auth.controller';
import { EmailModule } from '../email/email.module';
import { AuthMiddleware } from './auth.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HiveModule } from '../hive/hive.module';
import { HiveChainModule } from '../../repositories/hive-chain/hive-chain.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { LinkedAccountModule } from '../../repositories/linked-accounts/linked-account.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    UserAccountModule,
    HiveChainModule,
    HiveAccountModule,
    HiveChainModule,
    HiveAccountModule,
    LinkedAccountModule,
    UserModule,
    HiveModule,
    EmailModule,
    SessionModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const key = configService.get<string>('JWT_PRIVATE_KEY');
        return {
          secretOrPrivateKey: key,
          signOptions: { expiresIn: '30d' },
        };
      },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, ConfigService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('/v1/auth/login_singleton/did');
  }
}
