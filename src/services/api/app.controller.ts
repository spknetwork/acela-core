import { Controller, Get, Request, Post, UseGuards, CanActivate, Injectable, ExecutionContext, Body, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { appContainer } from '.';
import { HiveClient } from '../../utils';
import { AuthService } from './auth/auth.service';
import * as DHive from '@hiveio/dhive'

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {


    return true;
  }
}


@Controller("/api/v1")
export class AppController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('/auth/login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(`/hive/linkaccount`)
  async linkAccount(@Body() data: any, @Request() req: any) {
    const {user_id} = req.user;
    console.log(user_id)
    console.log('user data', req.user.user_id)
    console.log(data)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(`/hive/vote`)
  async votePost(@Body() data: any) {
    
    console.log(data)
    const delegatedAuth = await appContainer.self.delegatedAuthority.findOne({
      // to: 'threespeak.beta',
      // from: 'vaultec'
    })
    if(!!delegatedAuth) {
      try {
        const out = await HiveClient.broadcast.vote({
          author: data.author,
          permlink: data.permlink,
          voter: 'vaultec',
          weight: 10_000 
        }, DHive.PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING))
        console.log(out)
        return out;
      } catch(ex) {
        console.log(ex)
        console.log(ex.message)
        throw new BadRequestException(ex.message)
      }
      // await appContainer.self
    } else {
      throw new BadRequestException(`Missing posting autority on HIVE account 'vaultec'`, {
        description: "HIVE_MISSING_POSTING_AUTHORITY"
      })
    }
    console.log(delegatedAuth)
  }
}