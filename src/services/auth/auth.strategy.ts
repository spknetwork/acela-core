import { Strategy } from 'passport-jwt';
import { Strategy as StrategyLocal } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ExtractJwt } from 'passport-jwt';
import 'dotenv/config';

@Injectable()
export class LocalStrategy extends PassportStrategy(StrategyLocal) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtPrivateKey = process.env.JWT_PRIVATE_KEY;
    console.log(jwtPrivateKey);
    if (!jwtPrivateKey) throw new Error('Missing JWT_PRIVATE_KEY in .env');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken,
      ignoreExpiration: false,
      secretOrKey: jwtPrivateKey,
    });
  }

  async validate(payload: any) {
    console.log(payload);
    return {
      id: payload.id,
      type: payload.type,
      user_id: payload.sub,
      username: payload.username,
    };
  }
}
