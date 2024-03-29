import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { JwtStrategy, LocalStrategy } from './auth.strategy';
import { UserModule } from '../../repositories/user/user.module';
import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';
import { AuthController } from './auth.controller';
import { EmailModule } from '../email/email.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { HiveModule } from '../../repositories/hive/hive.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    UserAccountModule,
    UserModule,
    HiveAccountModule,
    HiveModule,
    EmailModule,
    SessionModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  providers: [ AuthService, LocalStrategy, JwtStrategy ],
  controllers: [ AuthController ],
  exports: [ AuthService ],
})
export class AuthModule {}