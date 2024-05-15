import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
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
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // console.log('Before...');

    const userAgent = context.switchToHttp().getRequest().headers['user-agent'];

    context.switchToHttp().getRequest().headers['test'] = 'true';
    context.switchToHttp().getRequest().user.test = 'true';

    return next.handle();
  }
}
