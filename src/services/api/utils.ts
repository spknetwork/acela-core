import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { User } from '../auth/auth.types';
import { DID, DagJWS, VerifyJWSResult } from 'dids';
import { Request, Response } from 'express';
import { authSchema } from '../auth/auth.interface';
import * as KeyDidResolver from 'key-did-resolver';

@Injectable()
export class UserDetailsInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest() satisfies Record<string, any>;
    const authorizationHeader: string = request.headers['authorization'];

    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      const token = authorizationHeader.split(' ')[1];
      try {
        const decodedToken = this.jwtService.decode(token);
        if (!decodedToken) {
          throw new Error('Invalid token');
        }
        request.user = decodedToken;
      } catch (err) {
        throw new Error('Invalid token');
      }
    }

    return next.handle();
  }
}

@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return true;
  }
}

@Injectable()
export class MockDidUserDetailsInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.user = {
      user_id: 'test_user_id',
      sub: 'singleton/did:key:z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5#z6MkjHhFz9hXYJKGrT5fShwJMzQpHGi63sS3wY3U1eH4n7i5/did',
      network: 'did',
      type: 'singleton',
    } satisfies User; // Mock user
    return next.handle();
  }
}

@Injectable()
export class MockHiveUserDetailsInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.user = {
      user_id: 'test_user_id',
      sub: 'singleton/starkerz/hive',
      network: 'hive',
      type: 'singleton',
    } satisfies User; // Mock user
    return next.handle();
  }
}

const VALID_TIMESTAMP_DIFF_MS = 1000 * 60 * 5;

export function isValidTimestamp(timestamp: number): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff < VALID_TIMESTAMP_DIFF_MS;
}

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request<any, any, string | DagJWS>>();
    const response = context.switchToHttp().getResponse<Response>();

    let verificationResult: VerifyJWSResult;
    const verifier = new DID({ resolver: KeyDidResolver.getResolver() });
    try {
      verificationResult = await verifier.verifyJWS(request.body);
    } catch (error) {
      console.error('Invalid signature', error);
      throw new UnauthorizedException('Invalid signature');
    }

    const authData = authSchema.parse(verificationResult.payload);
    const { did, iat } = authData;

    if (did !== verificationResult.kid.split('#')[0]) {
      console.error('Invalid DID:', did);
      console.error('Expected DID:', verificationResult.kid);
      throw new UnauthorizedException('Invalid DID');
    }

    if (!isValidTimestamp(iat)) {
      console.error('Invalid timestamp:', iat);
      throw new UnauthorizedException('Invalid timestamp');
    }

    request.body = verificationResult.payload as any;

    return next.handle();
  }
}
