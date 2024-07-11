import { Strategy } from 'passport-jwt';
import { Strategy as StrategyLocal } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ExtractJwt } from 'passport-jwt';
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStrategy extends PassportStrategy(StrategyLocal) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(email: string, password: string) {
    return await this.authService.validateUser(email, password);
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtPrivateKey = configService.get<string>('JWT_PRIVATE_KEY');
    if (!jwtPrivateKey) throw new Error('Missing JWT_PRIVATE_KEY in .env');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtPrivateKey,
    });
  }

  async validate(payload: any) {
    return {
      id: payload.id,
      type: payload.type,
      user_id: payload.sub,
      username: payload.username,
    };
  }
}
