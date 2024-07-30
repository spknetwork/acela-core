import {
  Controller,
  Get,
  Request,
  Post,
  UseGuards,
  Body,
  UseInterceptors,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';
import { UserDetailsInterceptor } from './utils';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { LegacyUserRepository } from '../../repositories/user/user.repository';
import { LinkAccountPostDto } from './dto/LinkAccountPost.dto';
import { VotePostResponseDto } from './dto/VotePostResponse.dto';
import { VotePostDto } from './dto/VotePost.dto';
import { parseAndValidateRequest } from '../auth/auth.utils';
import { HiveService } from '../hive/hive.service';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import { UnlinkAccountPostDto } from './dto/UnlinkAccountPost.dto';

@Controller('/v1')
export class ApiController {
  readonly #logger: Logger = new Logger(ApiController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: LegacyUserRepository,
    private readonly hiveService: HiveService,
    private readonly hiveChainRepository: HiveChainRepository,
  ) {}

  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Authorization',
    example:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    required: true,
  })
  @ApiBody({
    schema: {
      properties: {
        body: {
          type: 'string',
          default: 'Example body',
        },
        parent_author: {
          type: 'string',
          default: 'sagarkothari88',
        },
        parent_permlink: {
          type: 'string',
          default: 'actifit-sagarkothari88-20230211t122818265z',
        },
        author: {
          type: 'string',
          default: 'test-account',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Successfully posted to HIVE blockchain',
    schema: {
      properties: {
        id: {
          type: 'string',
          default: 'f555e5e690aefa99f5d6c1fe47c08db6ad79af1f',
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('/hive/post_comment')
  async postHiveComment(
    @Body()
    reqBody: {
      author: string;
      body: string;
      parent_author: string;
      parent_permlink: string;
    },
  ) {
    const { body, parent_author, parent_permlink, author } = reqBody;

    //TODO: Do validation of account ownership before doing operation
    return await this.hiveChainRepository.comment(author, body, { parent_author, parent_permlink });
  }

  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(UserDetailsInterceptor)
  @Get('/profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Authorization',
    required: true,
    schema: {
      example:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      // default: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    },
  })
  @ApiBody({
    schema: {
      properties: {
        username: {
          type: 'string',
          default: 'test-account',
        },
      },
    },
  })
  @ApiOkResponse({
    schema: {
      properties: {
        challenge: {
          type: 'string',
          default: 'aa3cb275-b923-4d71-ae55-3330e1cb508b',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      properties: {
        reason: {
          type: 'string',
          enum: ['Hive account already linked'],
          default: 'Hive account already linked',
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(UserDetailsInterceptor)
  @Post(`/hive/linkaccount`)
  async linkAccount(@Body() data: LinkAccountPostDto, @Request() req: unknown) {
    const parsedRequest = parseAndValidateRequest(req, this.#logger);

    const user = await this.authService.getUserByUserId({ user_id: parsedRequest.user.user_id });

    if (!user) throw new UnauthorizedException('User not found');

    return await this.hiveService.linkHiveAccount({
      proof: data.proof,
      hiveUsername: data.username,
      user_id: parsedRequest.user.user_id,
      db_user_id: user._id,
    });
  }

  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Authorization',
    required: true,
    schema: {
      example:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      // default: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    },
  })
  @ApiBody({
    schema: {
      properties: {
        username: {
          type: 'string',
          default: 'test-account',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      properties: {
        reason: {
          type: 'string',
          enum: ['User not found'],
          default: 'User not found',
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(UserDetailsInterceptor)
  @Post(`/hive/unlinkaccount`)
  async unlinkAccount(@Body() data: UnlinkAccountPostDto, @Request() req: unknown) {
    const parsedRequest = parseAndValidateRequest(req, this.#logger);

    const user = await this.authService.getUserByUserId({ user_id: parsedRequest.user.user_id });

    if (!user) throw new UnauthorizedException('User not found');

    return await this.authService.unlinkHiveAccount({
      username: data.username,
      user_id: user._id,
    });
  }

  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Authorization',
    required: true,
    schema: {
      example:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
  })
  @ApiOkResponse({
    schema: {
      properties: {
        accounts: {
          type: 'array',
          default: [],
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(UserDetailsInterceptor)
  @Get('/hive/linked-account/list')
  async listLinkedAccounts(@Request() req: unknown) {
    const request = parseAndValidateRequest(req, this.#logger);
    // TODO: before going live, check that current linked accounts will still show since user.sub is a proprietary new format
    const accounts = {
      accounts: (await this.userRepository.getLegacyLinkedHiveAccounts(request.user.user_id))
        .linked_hiveaccounts,
    };
    return accounts;
  }

  @ApiOperation({
    summary: 'Votes on a piece of HIVE content using logged in account',
  })
  @ApiOkResponse({
    description: 'Successfully voted',
    type: VotePostResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(UserDetailsInterceptor)
  @Post(`/hive/vote`)
  async votePost(@Body() data: VotePostDto, @Request() req: any) {
    const parsedRequest = parseAndValidateRequest(req, this.#logger);
    const { author, permlink, weight, votingAccount } = data;

    const user = await this.authService.getUserByUserId({ user_id: parsedRequest.user.user_id });

    if (!user) throw new UnauthorizedException('User not found');

    return await this.hiveService.vote({
      sub: parsedRequest.user.sub,
      votingAccount,
      author,
      permlink,
      weight,
      network: parsedRequest.user.network,
      user_id: user._id,
    });
  }
}
