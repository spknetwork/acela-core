import { Module } from '@nestjs/common'
import { HiveuserController } from './hiveuser.controller'
import { HiveuserService } from './hiveuser.service'
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/constants';
import { JwtStrategy } from '../auth/auth.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  providers: [HiveuserService, JwtStrategy],
  controllers: [HiveuserController],
})
export class HiveuserModule {}
