import { cryptoUtils } from "@hiveio/dhive";
import { BadRequestException, Body, Controller, Get, Headers, HttpException, HttpStatus, Post, Request, Response, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiOkResponse, ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiHeader, ApiUnauthorizedResponse, ApiOperation, ApiBody, ApiParam, ApiMovedPermanentlyResponse } from "@nestjs/swagger";
import moment from "moment";
import { authenticator } from "otplib";
import { HiveClient } from "../../utils/hiveClient";
import { LoginDto } from "../api/dto/Login.dto";
import { LoginErrorResponseDto } from "../api/dto/LoginErrorResponse.dto";
import { LoginResponseDto } from "../api/dto/LoginResponse.dto";
import { LoginSingletonDto } from "../api/dto/LoginSingleton.dto";
import { AuthService } from "./auth.service";
import { HiveAccountRepository } from "../../repositories/hive-account/hive-account.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { HiveRepository } from "../../repositories/hive/hive.repository";
import { EmailService } from "../email/email.service";
import bcrypt from 'bcryptjs'
import { Magic } from '@magic-sdk/admin';

@Controller('/api/v1/auth')
export class AuthController {
  readonly #magic = new Magic(process.env.MAGIC_SECRET_KEY);

  constructor(
    private readonly authService: AuthService,
    private readonly hiveAccountRepository: HiveAccountRepository,
    private readonly userRepository: UserRepository,
    private readonly hiveRepository: HiveRepository,
    //private readonly delegatedAuthorityRepository: DelegatedAuthorityRepository,
    private readonly emailService: EmailService
  ) {}


  @UseGuards(AuthGuard('local'))
  @Post('/login')
  @ApiOkResponse({
    description: "Login success",
    type: LoginResponseDto
  })
  async login(@Request() req, @Body() body: LoginDto) {
    return this.authService.login(req.user)
  }

  //@UseGuards(AuthGuard('local'))
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
  @Post('/login_singleton')
  async loginSingletonReturn(@Body() body: LoginSingletonDto, @Headers('authorization') didToken?: string) {
    if (body.network === 'hive') {
      const proof_payload = JSON.parse(body.proof_payload)
      const accountDetails = await this.hiveRepository.getAccount(proof_payload.account)

      if (
        this.hiveRepository.verifyHiveMessage(cryptoUtils.sha256(JSON.stringify(proof_payload)), body.proof, accountDetails) &&
        new Date(proof_payload.ts) > moment().subtract('1', 'minute').toDate() //Extra safety to prevent request reuse
      ) {
        if (this.hiveRepository.verifyPostingAuth(accountDetails)) {
          return await this.authService.authenticateUser(proof_payload.account)
        } else {
          throw new HttpException(
            {
              reason: `Hive Account @${proof_payload.account} has not granted posting authority to @threespeak`,
              errorType: "MISSING_POSTING_AUTHORITY"
            },
            HttpStatus.BAD_REQUEST,
          )
        }
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
      try {
        await this.#magic.token.validate(didToken)
        return {
          valid: true
        }
      } catch {
        throw new HttpException(
          {
            reason: 'Invalid Decentralized ID',
            errorType: "INVALID_DID"
          },
          HttpStatus.UNAUTHORIZED,
        )
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
  @Post('/check')
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
  @Post('/lite/register-initial')
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
  // @Post('/lite/register-initial')
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
  @Post('/register')
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
  @Get('/verifyemail')
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
  @Post('/request_hive_account')
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
}