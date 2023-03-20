import { Module } from '@nestjs/common'
// import { HiveuserService } from '../hiveuser/hiveuser.service'
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/constants';
import { JwtStrategy } from '../auth/auth.strategy';
import { PassportModule } from '@nestjs/passport';
import { HiveauthuserController } from './hiveauthuser.controller'; 
import { HiveauthuserService } from './hiveauthuser.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  providers: [HiveauthuserService, JwtStrategy],
  controllers: [HiveauthuserController],
})
export class HiveauthuserModule {}
