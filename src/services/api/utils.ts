import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { User } from '../auth/auth.types';

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
        console.log(decodedToken);
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
export class MockUserDetailsInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.user = {
      id: 'test_user_id',
      sub: 'singleton/bob/did',
      username: 'test_user_id',
      network: 'did',
      type: 'singleton',
    } satisfies User; // Mock user
    return next.handle();
  }
}
