import { Module } from '@nestjs/common'
import { TrustedclientsService } from './trustedclients.service'
import { TrustedclientsController } from './trustedclients.controller'
import { HiveuserService } from '../hiveuser/hiveuser.service'
import { JwtModule } from '@nestjs/jwt'
import { jwtConstants } from '../auth/constants'
import { JwtStrategy } from '../auth/auth.strategy'
import { PassportModule } from '@nestjs/passport'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  providers: [TrustedclientsService, HiveuserService, JwtStrategy],
  controllers: [TrustedclientsController],
})
export class TrustedclientsModule {}
