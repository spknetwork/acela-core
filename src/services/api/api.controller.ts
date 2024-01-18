import {
  Controller,
  Get,
  Request,
  Post,
  UseGuards,
  Body,
  BadRequestException,
  Response,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { HiveClient } from '../../utils/hiveClient'
import { AuthService } from '../auth/auth.service'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { RequireHiveVerify } from './utils'
import { cryptoUtils } from '@hiveio/dhive'
import moment from 'moment'
import { authenticator } from 'otplib'
import { ApiBadRequestResponse, ApiBody, ApiHeader, ApiInternalServerErrorResponse, ApiMovedPermanentlyResponse, ApiOkResponse, ApiOperation, ApiParam, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { HiveAccountRepository } from '../../repositories/hive-account/hive-account.repository'
import { UserRepository } from '../../repositories/user/user.repository'
import { HiveRepository } from '../../repositories/hive/hive.repository'
import { DelegatedAuthorityRepository } from '../../repositories/delegated-authority/delegated-authority.repository'
import { LinkAccountPostDto } from './dto/LinkAccountPost.dto'
import { LoginErrorResponseDto } from './dto/LoginErrorResponse.dto'
import { VotePostResponseDto } from './dto/VotePostResponse.dto'
import { VotePostDto } from './dto/VotePost.dto'
import { LoginResponseDto } from './dto/LoginResponse.dto'
import { LoginDto } from './dto/Login.dto'
import { LoginSingletonDto } from './dto/LoginSingleton.dto'
import { LinkedAccountRepository } from '../../repositories/linked-accounts/linked-account.repository'
import { EmailService } from '../email/email.service'

@Controller('/api/v1')
export class ApiController {
  constructor(
    private readonly authService: AuthService,
    private readonly hiveAccountRepository: HiveAccountRepository,
    private readonly userRepository: UserRepository,
    private readonly hiveRepository: HiveRepository,
    //private readonly delegatedAuthorityRepository: DelegatedAuthorityRepository,
    private readonly linkedAccountsRepository: LinkedAccountRepository,
    private readonly emailService: EmailService
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('/auth/login')
  @ApiOkResponse({
    description: "Login success",
    type: LoginResponseDto
  })
  async login(@Request() req, @Body() body: LoginDto) {
    return this.authService.login(req.user)
  }

  // @UseGuards(AuthGuard('local'))
  @ApiOkResponse({
    description: "Successfully logged in",
    type: LoginResponseDto
  })
  @ApiBadRequestResponse({
    description: "Invalid options",
    type: LoginErrorResponseDto
  })
  @ApiInternalServerErrorResponse({
    description: "Internal Server Error - unrelated to request body"
  })
  @Post('/auth/login_singleton')
  async loginSingletonReturn(@Body() body: LoginSingletonDto) {
    // console.log(req)
    if (body.network === 'hive') {
      const proof_payload = JSON.parse(body.proof_payload)
      const accountDetails = await this.hiveRepository.getAccount(proof_payload.account)

      if (
        this.hiveRepository.verifyHiveMessage(cryptoUtils.sha256(proof_payload), body.proof, accountDetails) &&
        new Date(proof_payload.ts) > moment().subtract('1', 'minute').toDate() //Extra safety to prevent request reuse
      ) {
        return await this.authService.authenticateUser(proof_payload.account)
      } else {
        throw new HttpException(
          {
            reason: 'Invalid Signature',
            errorType: "INVALID_SIGNATURE"
          },
          HttpStatus.BAD_REQUEST,
        )
      }
    } else if (body.network === 'did') {
      return {
        access_token: null,
      }
    } else {
      throw new HttpException(
        {
          reason: 'Unsupported network type',
          errorType: "UNSUPPORTED_NETWORK"
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    // return this.authService.login(req.user)
  }

  @ApiHeader({
    name: "Authorization",
    description: "JWT Authorization",
    example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    required: true
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: {
          type: 'boolean',
          default: true
        }
      }
    }
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or expired authentication token"
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('/auth/check')
  async checkAuth(@Request() req) {
    console.log('user details check', req.user)
    return {
      ok: true
    }
  }

  @ApiOperation({
    summary: "Registers an account using light OTP/TOTP login"
  })
  @ApiBody({
    schema: {
      properties: {
        username: {
          type: 'string',
          default: "test-account"
        },
        otp_code: {
          type: 'string',
          default: '029735'
        },
        secret: {
          type: 'string',
          default: "GYZWKZBSGUYDEMLGHFTDQYJWHEYTKMLCMZQTGZA"
        } 
      }
    }
  })
  @ApiOkResponse({
    description: "Successfully logged in",
    type: LoginResponseDto
  })
  @ApiBadRequestResponse({
    description: "Invalid options",
    schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ['Invalid OTP code', 'Hive account with the requested name already exists'],
          default: 'Invalid OTP code'
        },
        errorType: {
          type: "string",
          enum: ['INVALID_OTP', 'HIVE_ACCOUNT_EXISTS'],
          default: 'INVALID_OTP'

        }
      }
    }
  })
  @ApiInternalServerErrorResponse({
    description: "Internal Server Error - unrelated to request body"
  })
  @Post('/auth/lite/register-initial')
  async registerLite(@Body() body) {
    const { username, otp_code } = body
    const output = await HiveClient.database.getAccounts([username])

    if (output.length === 0) {
      // const secret = authenticator.generateSecret(32)
      
      if(authenticator.verify({
        token: otp_code,
        secret: body.secret
      })) {
        // const accountCreation = await createAccountWithAuthority(
        //   username,
        //   process.env.ACCOUNT_CREATOR
        // )
        await this.hiveAccountRepository.createLite(username, body.secret)

        const jwt = await this.authService.jwtService.signAsync({
          username,
        })

        return {
          // id: accountCreation.id,
          access_token: jwt
        }
      } else {
        throw new HttpException({
          reason: "Invalid OTP code",
          errorType: "INVALID_OTP"
        }, HttpStatus.BAD_REQUEST)
      }

    } else {
      throw new HttpException({ 
          reason: 'Hive account with the requested name already exists', 
          errorType: "HIVE_ACCOUNT_EXISTS"
        },
        HttpStatus.BAD_REQUEST,
      )
    }

  }
  // @Post('/auth/lite/register-initial')
  // async registerLiteFinish(@Body() body) {
  //   await appContainer.self.usersDb.insertOne({
  //     status: 'requested',
  //     username: body.username
  //   })
  // }

  @ApiOperation({
    summary: "Registers an account using email/password login"
  })
  @ApiBody({
    schema: {
      properties: {
        password: {
          type: 'string',
          default: "!SUPER-SECRET_PASSWORD!"
        },
        email: {
          type: 'string',
          default: 'test@invalid.example.org'
        }
      }
    }
  })
  @ApiOkResponse({
    schema: {
      properties: {
        ok: {
          type: 'boolean',
          default: true
        }
      }
    }
  })
  // @UseGuards(AuthGuard('local'))
  @Post('/auth/register')
  async register(@Request() req, @Body() body) {
    const password = req.body.password
    const {email} = req.body;
    const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10))

    const existingRecord = await this.userRepository.findOneByEmail(email)

    if(existingRecord) {
      throw new HttpException(
        { reason: 'Email Password account already created!' },
        HttpStatus.BAD_REQUEST,
      ) 
    } else {
      
      const { email_code } = await this.authService.createUser(email, hashedPassword)

      await this.emailService.sendRegistration(email, email_code);
      return {
        ok: true
      }
    }
    // return this.authService.login(req.user);
  }

  @ApiParam({
    name: "code",
    type: 'string'
  })
  @ApiMovedPermanentlyResponse({
    description: "Redirect user to 3Speak.tv",
  })
  @Get('/auth/verifyemail')
  async verifyEmail(@Request() req, @Response() res) {
    const verifyCode = req.query.code

    if (!verifyCode) {
      throw new BadRequestException('Verification code is required');
    }

    await this.userRepository.verifyEmail(verifyCode);

    return res.redirect('https://3speak.tv')
  }


  @ApiHeader({
    name: "Authorization",
    description: "JWT Authorization",
    example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    required: true
  })
  @ApiBody({
    schema: {
      properties: {
        username: {
          type: 'string',
          default: "test-account",
          description: "Username of requested HIVE account"
        }
      }
    }
  })
  @ApiOkResponse({
    description: "Account created",
    schema: {
      properties: {
        id: {
          type: 'string',
          default: "f555e5e690aefa99f5d6c1fe47c08db6ad79af1f"
        }
      }
    }
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('/auth/request_hive_account')
  async requestHiveAccount(@Request() req) {
    const existingAcocunt = await this.hiveAccountRepository.findOneByOwner(req.user.user_id)
    if (existingAcocunt) {
      throw new HttpException(
        { reason: 'You have already created the maximum of 1 free Hive account' },
        HttpStatus.BAD_REQUEST,
      )
    }
    // console.log(existingAcocunt)
    const output = await HiveClient.database.getAccounts([req.body.username])
    // console.log(output)
    if (output.length === 0) {
      try {
        const accountCreation = await this.hiveRepository.createAccountWithAuthority(
          req.body.username,
          process.env.ACCOUNT_CREATOR,
        )
        //Here will be thrown if failed at this point
  
        await this.hiveAccountRepository.insertCreated(req.body.username, req.user.user_id)
        
        return accountCreation
      } catch(ex) {
        throw new HttpException(
          { reason: `On chain error - ${ex.message}` },
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
      }
    } else {
      throw new HttpException(
        { reason: 'Hive account with the requested name already exists' },
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  @ApiHeader({
    name: "Authorization",
    description: "JWT Authorization",
    example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    required: true,
  })
  @ApiBody({
    schema: {
      properties: {
        body: {
          type: 'string',
          default: "Example body"
        }, 
        parent_author: {
          type: 'string',
          default: "sagarkothari88"
        }, 
        parent_permlink: {
          type: 'string',
          default: "actifit-sagarkothari88-20230211t122818265z"
        }, 
        author: {
          type: 'string',
          default: "test-account"
        }
      }
    }
  })
  @ApiOkResponse({
    description: "Successfully posted to HIVE blockchain",
    schema: {
      properties: {
        id: {
          type: 'string',
          default: "f555e5e690aefa99f5d6c1fe47c08db6ad79af1f"
        }
      }
    }
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('/hive/post_comment')
  async postHiveComment(@Body() reqBody) {
    const { body, parent_author, parent_permlink, author } = reqBody
    // console.log(body)

    //TODO: Do validation of account ownership before doing operation
    return await this.hiveRepository.comment(author, body, { parent_author, parent_permlink })
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/profile')
  getProfile(@Request() req) {
    return req.user
  }

  @ApiHeader({
    name: "Authorization",
    description: "JWT Authorization",
    required: true,
    schema: {
      example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      // default: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    }
  })
  @ApiBody({
    schema: {
      properties: {
        username: {
          type: 'string',
          default: 'test-account'
        }
      }
    }
  })
  @ApiOkResponse({
    schema: {
      properties: {
        challenge: {
          type: 'string',
          default: "aa3cb275-b923-4d71-ae55-3330e1cb508b"
        }
      }
    }
  })
  @ApiBadRequestResponse({
    schema: {
      properties: {
        reason: {
          type: 'string',
          enum: ["Hive account already linked"],
          default: "Hive account already linked"
        }
      }
    }
  })
  @UseGuards(AuthGuard('jwt'))
  @Post(`/hive/linkaccount`)
  async linkAccount(@Body() data: LinkAccountPostDto, @Request() req: any) {
    const { user_id } = req.user // TODO: security
    const linkedAccount = await this.linkedAccountsRepository.findOneByUserIdAndAccountName({
      user_id: user_id,
      account: data.username,
    })
    if (!linkedAccount) {
      const challenge = uuid()
      await this.linkedAccountsRepository.linkHiveAccount(user_id, data.username, challenge)

      return {
        challenge,
      }
    }
    if (linkedAccount.status === 'unverified') {
      return {
        challenge: linkedAccount.challenge,
      }
    } else {
      throw new HttpException({ reason: 'Hive account already linked' }, HttpStatus.BAD_REQUEST)
    }
  }
  
  @ApiHeader({
    name: "Authorization",
    description: "JWT Authorization",
    required: true,
    schema: {
      example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    }
  })
  @ApiBody({
    schema: {
      properties: {
        memo: {
          type: 'string'
        }
      }
    }
  })
  @ApiBadRequestResponse({
    schema: {
      properties: {
        reason: {
          type: "string",
          enum: ['Incorrect signing account', 'Incorrect signature']
        }
      }
    }
  })
  @UseGuards(AuthGuard('jwt'))
  @Post(`/hive/verify_linked_account`)
  async verifyLinkedAccount(@Body() data: any, @Request() req: any) {
    const { memo } = data;
    console.log(memo);
  
    const message = await this.hiveRepository.getPublicKeys(memo);
    const pubKeys = await this.hiveRepository.getPublicKeys(memo);
  
    const [account] = await HiveClient.database.getAccounts([message.account]);
    console.log(account[message.authority], pubKeys);
  
    // Check if the signature is not valid
    const signatureValid = account[message.authority].key_auths.some(key_auth => key_auth[0] === pubKeys[0]);
    if (!signatureValid) {
      throw new HttpException({ reason: 'Incorrect signature' }, HttpStatus.BAD_REQUEST);
    }
  
    const identityChallenge = await this.linkedAccountsRepository.findOneByChallenge({
      challenge: message.message,
    });
    console.log(signatureValid, account, message.message, identityChallenge);
    
    if (identityChallenge.account !== account.name) {
      throw new HttpException({ reason: 'Incorrect signing account' }, HttpStatus.BAD_REQUEST);
    }
  
    await this.linkedAccountsRepository.verify(identityChallenge._id);
    return { ok: true };
  }

  @ApiOperation({
    summary: "Votes on a piece of HIVE content using logged in account"
  })
  @ApiOkResponse({
    description: "Successfully voted",
    type: VotePostResponseDto
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
    if (!!delegatedAuth) {
      try {
        // console.log(out)
        return this.hiveRepository.vote({ author, permlink, voter, weight: 500 })
      } catch (ex) {
        console.log(ex)
        console.log(ex.message)
        throw new BadRequestException(ex.message)
      }
      // await appContainer.self
    } else {
      throw new BadRequestException(`Missing posting autority on HIVE account 'vaultec'`, {
        description: 'HIVE_MISSING_POSTING_AUTHORITY',
      })
    }
  }
}
