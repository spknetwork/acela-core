import {
  Controller,
  Get,
  Request,
  Post,
  UseGuards,
  Body,
  BadRequestException,
  HttpException,
  HttpStatus,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth/auth.service';
import { v4 as uuid } from 'uuid';
import { RequireHiveVerify, UserDetailsInterceptor } from './utils';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { HiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { UserRepository } from '../../repositories/user/user.repository';
import { HiveRepository } from '../../repositories/hive-chain/hive-chain.repository';
import { LinkAccountPostDto } from './dto/LinkAccountPost.dto';
import { VotePostResponseDto } from './dto/VotePostResponse.dto';
import { VotePostDto } from './dto/VotePost.dto';
import { LinkedAccountRepository } from '../../repositories/linked-accounts/linked-account.repository';
import { EmailService } from '../email/email.service';
import { parseAndValidateRequest } from '../auth/auth.utils';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';

@Controller('/api/v1')
export class ApiController {
  readonly #logger = new Logger();

  constructor(
    private readonly authService: AuthService,
    private readonly hiveAccountRepository: HiveAccountRepository,
    private readonly userRepository: UserRepository,
    private readonly hiveChainRepository: HiveChainRepository,
    //private readonly delegatedAuthorityRepository: DelegatedAuthorityRepository,
    private readonly linkedAccountsRepository: LinkedAccountRepository,
    private readonly emailService: EmailService,
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
    // console.log(body)

    //TODO: Do validation of account ownership before doing operation
    return await this.hiveChainRepository.comment(author, body, { parent_author, parent_permlink });
  }

  @UseGuards(AuthGuard('jwt'))
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
    const linkedAccount = await this.linkedAccountsRepository.findOneByUserIdAndAccountName({
      user_id: parsedRequest.user.sub,
      account: data.username,
    });
    if (!linkedAccount) {
      // TODO: and zero knowledge proof of hive account ownership
      const challenge = uuid();
      await this.linkedAccountsRepository.linkHiveAccount(
        parsedRequest.user.sub,
        data.username,
        challenge,
      );

      return {
        challenge,
      };
    }
    if (linkedAccount.status === 'unverified') {
      return {
        challenge: linkedAccount.challenge,
      };
    } else {
      throw new HttpException({ reason: 'Hive account already linked' }, HttpStatus.BAD_REQUEST);
    }
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
    if (!request.user.sub) {
      throw new HttpException(
        {
          reason: 'Logged in with a lite account, full account needed to check linked accounts.',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    // TODO: before going live, check that current linked accounts will still show since user.sub is a proprietary new format
    const accounts = await this.linkedAccountsRepository.findAllByUserId(request.user.sub);
    return { accounts: accounts.map((account) => account.account) };
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
  @ApiBody({
    schema: {
      properties: {
        memo: {
          type: 'string',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      properties: {
        reason: {
          type: 'string',
          enum: ['Incorrect signing account', 'Incorrect signature'],
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @Post(`/hive/verify_linked_account`)
  async verifyLinkedAccount(@Body() data: { memo: string }, @Request() req: any) {
    const { memo } = data;
    console.log(memo);

    const message = this.hiveChainRepository.decodeMessage(memo) as {
      account: string;
      authority: string;
      message: string;
    };
    const pubKeys = await this.hiveChainRepository.getPublicKeys(memo);

    const account = await this.hiveChainRepository.getAccount(message.account);

    if (!account) {
      throw new HttpException({ reason: 'Account not found' }, HttpStatus.BAD_REQUEST);
    }
    console.log(account[message.authority], pubKeys);

    // Check if the signature is not valid
    const signatureValid = account[message.authority].key_auths.some(
      (key_auth) => key_auth[0] === pubKeys[0],
    );
    if (!signatureValid) {
      throw new HttpException({ reason: 'Incorrect signature' }, HttpStatus.BAD_REQUEST);
    }

    const identityChallenge = await this.linkedAccountsRepository.findOneByChallenge({
      challenge: message.message,
    });

    if (!identityChallenge) {
      throw new HttpException({ reason: 'Challenge not found' }, HttpStatus.BAD_REQUEST);
    }

    console.log(signatureValid, account, message.message, identityChallenge);

    if (identityChallenge.account !== account.name) {
      throw new HttpException({ reason: 'Incorrect signing account' }, HttpStatus.BAD_REQUEST);
    }

    await this.linkedAccountsRepository.verify(identityChallenge._id);
    return { ok: true };
  }

  @ApiOperation({
    summary: 'Votes on a piece of HIVE content using logged in account',
  })
  @ApiOkResponse({
    description: 'Successfully voted',
    type: VotePostResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @UseGuards(RequireHiveVerify)
  @Post(`/hive/vote`)
  async votePost(@Body() data: VotePostDto) {
    const { author, permlink } = data;
    // const delegatedAuth = await this.delegatedAuthorityRepository.findOne({
    //   to: 'threespeak.beta',
    //   from:
    // })
    // TODO: get hive username from auth
    const delegatedAuth = true;
    const voter = 'vaultec';
    if (delegatedAuth) {
      try {
        // console.log(out)
        return this.hiveRepository.vote({ author, permlink, voter, weight: 500 });
      } catch (ex) {
        console.log(ex);
        console.log(ex.message);
        throw new BadRequestException(ex.message);
      }
      // await appContainer.self
    } else {
      throw new BadRequestException(`Missing posting autority on HIVE account 'vaultec'`, {
        description: 'HIVE_MISSING_POSTING_AUTHORITY',
      });
    }
  }
}
