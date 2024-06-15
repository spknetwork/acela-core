import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

@Injectable()
export class RequireHiveVerify implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const args = context.getArgs();

    const { body } = args[0];
    // console.log('RequireHiveVerify guard', {
    //     body,
    //     user: args[0].user
    // })

    return true;
  }
}

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
        console.log(decodedToken);
        request.user = decodedToken;
      } catch (err) {
        console.error('Invalid token', err);
      }
    }

    return next.handle();
  }
}
