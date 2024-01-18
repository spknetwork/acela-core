import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { JwtStrategy, LocalStrategy } from './auth.strategy';
import { UserModule } from '../../repositories/user/user.module';
import { UserRepository } from '../../repositories/user/user.repository';
import { UserAccountRepository } from '../../repositories/userAccount/user-account.repository';
import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';
import { SessionRepository } from '../../repositories/session/session.repository';

@Module({
  imports: [
    UserModule,
    PassportModule,
    UserAccountModule,
    SessionModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}