import { TransactionConfirmation } from '@hiveio/dhive';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiHeader,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiMovedPermanentlyResponse,
} from '@nestjs/swagger';
import moment from 'moment';
import { authenticator } from 'otplib';
import { HiveClient } from '../../utils/hiveClient';
import { LoginDto } from '../api/dto/Login.dto';
import { LoginErrorResponseDto } from '../api/dto/LoginErrorResponse.dto';
import { LoginResponseDto } from '../api/dto/LoginResponse.dto';
import { LoginSingletonDidDto, LoginSingletonHiveDto } from '../api/dto/LoginSingleton.dto';
import { AuthService } from './auth.service';
import { LegacyHiveAccountRepository } from '../../repositories/hive-account/hive-account.repository';
import { LegacyUserRepository } from '../../repositories/user/user.repository';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import { EmailService } from '../email/email.service';
import { parseAndValidateRequest } from './auth.utils';
import { RequestHiveAccountDto } from '../api/dto/RequestHiveAccount.dto';
import { HiveService } from '../hive/hive.service';
import { AuthInterceptor, UserDetailsInterceptor } from '../api/utils';
import { randomUUID } from 'crypto';
import { EmailRegisterDto } from './dto/EmailRegister.dto';

@Controller('/v1/auth')
export class AuthController {
  readonly #logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly hiveAccountRepository: LegacyHiveAccountRepository,
    private readonly userRepository: LegacyUserRepository,
    private readonly hiveRepository: HiveChainRepository,
    private readonly hiveService: HiveService,
    //private readonly delegatedAuthorityRepository: DelegatedAuthorityRepository,
    private readonly emailService: EmailService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  @ApiOkResponse({
    description: 'Login success',
    type: LoginResponseDto,
  })
  async login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return await this.authService.login(body.username);
  }

  //@UseGuards(AuthGuard('local'))
  @ApiOkResponse({
    description: 'Successfully logged in',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid options',
    type: LoginErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error - unrelated to request body',
  })
  @Post('/login/singleton/hive')
  async loginSingletonHive(@Body() body: LoginSingletonHiveDto) {
    const accountDetails = await this.hiveRepository.getAccount(body.proof_payload.account);

    if (!accountDetails) {
      throw new HttpException(
        {
          reason: `Hive Account @${body.proof_payload.account} does not exist`,
          errorType: 'ACCOUNT_NOT_FOUND',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.hiveRepository.verifyHiveMessage(
      JSON.stringify(body.proof_payload),
      body.proof,
      accountDetails,
    );

    const proofCreationTimestamp = new Date(body.proof_payload.ts);

    const proofCreatedWithinAMinute =
      proofCreationTimestamp > moment().subtract('1', 'minute').toDate() &&
      proofCreationTimestamp < new Date();

    if (!proofCreatedWithinAMinute) {
      throw new HttpException(
        {
          reason: 'Invalid Signature',
          errorType: 'INVALID_SIGNATURE',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!this.hiveRepository.verifyPostingAuth(accountDetails)) {
      throw new HttpException(
        {
          reason: `Hive Account @${body.proof_payload.account} has not granted posting authority to @threespeak`,
          errorType: 'MISSING_POSTING_AUTHORITY',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.authService.getOrCreateUserByHiveUsername(body.proof_payload.account);

    return await this.authService.authenticateUser('singleton', body.proof_payload.account, 'hive');
  }

  //@UseGuards(AuthGuard('local'))
  @ApiOkResponse({
    description: 'Successfully logged in',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid options',
    type: LoginErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error - unrelated to request body',
  })
  @HttpCode(200)
  @UseInterceptors(AuthInterceptor)
  @Post('/login/singleton/did')
  async loginSingletonReturn(@Body() body: LoginSingletonDidDto) {
    try {
      await this.authService.getOrCreateUserByDid(body.did);
      return await this.authService.authenticateUserByDid(body.did);
    } catch (e) {
      this.#logger.error(e);
      throw new HttpException(
        {
          reason: e,
          errorType: 'UNKNOWN_SERVER_ERROR',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    // return this.authService.login(req.user)
  }

  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Authorization',
    example:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    required: true,
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: {
          type: 'boolean',
          default: true,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired authentication token',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('/check')
  async checkAuth(@Request() req) {
    this.#logger.log('user details check', req.user);
    return {
      ok: true,
    };
  }

  @ApiOperation({
    summary: 'Registers an account using light OTP/TOTP login',
  })
  @ApiBody({
    schema: {
      properties: {
        username: {
          type: 'string',
          default: 'test-account',
        },
        otp_code: {
          type: 'string',
          default: '029735',
        },
        secret: {
          type: 'string',
          default: 'GYZWKZBSGUYDEMLGHFTDQYJWHEYTKMLCMZQTGZA',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Successfully logged in',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid options',
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['Invalid OTP code', 'Hive account with the requested name already exists'],
          default: 'Invalid OTP code',
        },
        errorType: {
          type: 'string',
          enum: ['INVALID_OTP', 'HIVE_ACCOUNT_EXISTS'],
          default: 'INVALID_OTP',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error - unrelated to request body',
  })
  @Post('/lite/register-initial')
  async registerLite(@Body() body: { username: string; otp_code: string; secret: string }) {
    const { username, otp_code } = body;
    const output = await HiveClient.database.getAccounts([username]);

    if (output.length === 0) {
      // const secret = authenticator.generateSecret(32)

      if (
        authenticator.verify({
          token: otp_code,
          secret: body.secret,
        })
      ) {
        // const accountCreation = await createAccountWithAuthority(
        //   username,
        //   process.env.ACCOUNT_CREATOR
        // )
        await this.hiveAccountRepository.createLite(username, body.secret);

        const sub = this.authService.generateSub('lite', username, 'hive');

        const user_id = randomUUID();

        await this.userRepository.createNewSubUser({ sub, user_id });

        const jwt = this.authService.jwtSign({
          sub,
          network: 'hive',
          user_id,
        });

        return {
          // id: accountCreation.id,
          access_token: jwt,
        };
      } else {
        throw new HttpException(
          {
            reason: 'Invalid OTP code',
            errorType: 'INVALID_OTP',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      throw new HttpException(
        {
          reason: 'Hive account with the requested name already exists',
          errorType: 'HIVE_ACCOUNT_EXISTS',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  // @Post('/lite/register-initial')
  // async registerLiteFinish(@Body() body) {
  //   await appContainer.self.usersDb.insertOne({
  //     status: 'requested',
  //     username: body.username
  //   })
  // }

  @ApiOperation({
    summary: 'Registers an account using email/password login',
  })
  @ApiBody({
    type: EmailRegisterDto,
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: {
          type: 'boolean',
          default: true,
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid options or email already registered',
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          default: 'Invalid email or password',
        },
        errorType: {
          type: 'string',
          default: 'VALIDATION_ERROR',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error - unrelated to request body',
  })
  @Post('/register')
  async register(@Body() body: EmailRegisterDto) {
    const { email, password } = body;

    return await this.authService.registerEmailAndPasswordUser(email, password);
  }

  @ApiParam({
    name: 'code',
    type: 'string',
  })
  @ApiMovedPermanentlyResponse({
    description: 'Redirect user to 3Speak.tv',
  })
  @Get('/verifyemail')
  async verifyEmail(@Request() req, @Query() query: { code: string }, @Response() res) {
    const verifyCode = query.code;

    if (!verifyCode) {
      throw new BadRequestException('Verification code is required');
    }

    await this.authService.verifyEmail(verifyCode);

    return res.redirect('https://3speak.tv');
  }

  // todo: send new verification code

  @ApiHeader({
    name: 'Authorization',
    description: 'JWT Authorization',
    example:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    required: true,
  })
  @ApiOkResponse({
    description: 'Account created',
    schema: {
      properties: {
        id: {
          type: 'string',
          default: 'f555e5e690aefa99f5d6c1fe47c08db6ad79af1f',
        },
        block_num: {
          type: 'number',
          default: 1,
        },
        trx_num: {
          type: 'number',
          default: 1,
        },
        expired: {
          type: 'boolean',
          default: false,
        },
      },
    },
  })
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(UserDetailsInterceptor)
  @Post('/request_hive_account')
  async requestHiveAccount(
    @Body() body: RequestHiveAccountDto,
    @Request() req,
  ): Promise<TransactionConfirmation> {
    const parsedRequest = parseAndValidateRequest(req, this.#logger);
    return await this.hiveService.requestHiveAccount(body.username, parsedRequest.user.user_id);
  }
}
