import { Module } from '@nestjs/common'
import { HiveuserController } from './hiveuser.controller'
import { HiveuserService } from './hiveuser.service'
import { JwtService } from '@nestjs/jwt'
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/constants';

@Module({
  imports: [
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '60s' },
    }),
  ],
  providers: [HiveuserService, JwtService],
  controllers: [HiveuserController],
})
export class HiveuserModule {}
