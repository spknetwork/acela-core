import {
  Controller,
  Get,
  Request,
  Post,
  UseGuards,
  CanActivate,
  Injectable,
  ExecutionContext,
  Body,
  BadRequestException,
  Response,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { appContainer } from '.'
import { HiveClient } from '../../utils'
import { AuthService } from './auth/auth.service'
import * as DHive from '@hiveio/dhive'
import hive from '@hiveio/hive-js'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import Mailgun from 'mailgun-js'
import Crypto from 'crypto'
import { IsEmail, IsNotEmpty, isString } from 'class-validator'
import { RequireHiveVerify } from './utils'
import { cryptoUtils } from '@hiveio/dhive'
import moment, { invalid } from 'moment'
import { authenticator } from 'otplib'
import { ApiBadRequestResponse, ApiBody, ApiCookieAuth, ApiHeader, ApiInternalServerErrorResponse, ApiMovedPermanentlyResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiResponseProperty, ApiUnauthorizedResponse } from '@nestjs/swagger'

const mg = new Mailgun({
  apiKey: process.env.MAIL_GUN_SECRET,
  domain: process.env.MAIL_GUN_DOMAIN,
})

async function createAccountWithAuthority(newAccountname, authorityAccountname, options?: {
  posting_auths?: string[]
  active_auths?: string[]
}) {
  const owner = {
    weight_threshold: 1,
    account_auths: [[authorityAccountname, 1]],
    key_auths: [],
  }
  const active = {
    weight_threshold: 1,
    account_auths: [[authorityAccountname, 1], ...(options?.active_auths || []).map(e => {
      return [e, 1]
    })],
    key_auths: [],
  }
  const posting = {
    weight_threshold: 1,
    account_auths: [[authorityAccountname, 1], ...(options?.posting_auths || []).map(e => {
      return [e, 1]
    })],
    key_auths: [],
  }
  const memo_key = 'STM7C9FCSZ6ntNsrwkU5MCvAB7TV44bUF8J4pwWLWpGY5Z7Ba7Q6e'

  const accountData = {
    creator: authorityAccountname,
    new_account_name: newAccountname,
    owner,
    active,
    posting,
    memo_key,
    json_metadata: JSON.stringify({
      // beneficiaries: [
      //   {
      //     name: 'spk.beneficiary',
      //     weight: 500,
      //     label: 'provider',
      //   },
      // ],
    }),
    extensions: [],
  }

  const operations: DHive.Operation[] = [['create_claimed_account', accountData]]

  return await HiveClient.broadcast.sendOperations(
    operations,
    DHive.PrivateKey.fromString(process.env.ACCOUNT_CREATOR_ACTIVE),
  )
}

class LoginSingletonDt {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Username of the account',
    default: "test-account",
  })
  username: string

  @IsNotEmpty()
  @ApiProperty({
    description: 'Network of the identity; Can be HIVE or CERAMIC',
    default: "HIVE",
  })
  network: string

  @IsNotEmpty()
  @ApiProperty({

  })
  authority_type: string

  proof_payload: string
  proof: string
}

class LoginDto {
  @ApiProperty({
    default: "test-account@fakedomain.com"
  })
  username: string

  @ApiProperty({
    default: "user-generated-password"
  })
  password: string
}

class LoginResponseDto {
  @ApiProperty({
    description: "JWT login token",
    default: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
  }) 
  access_token: string
}

class VotePostDto {
  @ApiProperty({
    default: "sagarkothari88"
  })
  author: string

  @ApiProperty({
    default: "actifit-sagarkothari88-20230211t122818265z"
  })
  permlink: string
}

class VotePostResponseDto {
  @ApiProperty({
    default: "f555e5e690aefa99f5d6c1fe47c08db6ad79af1f"
  })
  id: string
}




enum LoginErrorPossibles {
  unsupportedNetwork = "UNSUPPORTED_NETWORK",
  invalidSignature = "INVALID_SIGNATURE"
}

enum LoginErrorReasonEnum {
  "Unsupported network type" = "Unsupported network type",
  "Invalid Signature" = "Invalid Signature"
}

class LoginErrorResponseDto {
  @ApiProperty({
    description: "Reason for failed response",
    enum: LoginErrorReasonEnum
  })
  reason: "Unsupported network type" | "Invalid Signature"

  @ApiProperty({
    description: "Error type enum - use this for application logic",
    enum: LoginErrorPossibles,
    isArray: false,
  })
  errorType: LoginErrorPossibles
}

class LinkAccountPost {
  @IsNotEmpty()
  username: string
}

function verifyHiveMessage(message, signature: string, account: DHive.ExtendedAccount): boolean {
  for (let auth of account.posting.key_auths) {

    const sigValidity = DHive.PublicKey.fromString(auth[0].toString()).verify(
      Buffer.from(message),
      DHive.Signature.fromBuffer(Buffer.from(signature, 'hex')),
    )
    if (sigValidity) {
      return true
    }
  }
  return false
}

@Controller('/api/v1')
export class AppController {
  constructor(private readonly authService: AuthService) {}

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
  async loginSingletonReturn(@Body() body: LoginSingletonDt) {
    // console.log(req)
    if (body.network === 'hive') {
      const proof_payload = JSON.parse(body.proof_payload)
      const [accountDetails] = await HiveClient.database.getAccounts([proof_payload.account])

      if (
        verifyHiveMessage(cryptoUtils.sha256(body.proof_payload), body.proof, accountDetails) &&
        new Date(proof_payload.ts) > moment().subtract('1', 'minute').toDate() //Extra safety to prevent request reuse
      ) {
        const id = uuid()
        const access_token = await this.authService.jwtService.sign({
          id: id,
          type: 'singleton',
          sub: `singleton/${proof_payload.account}`,
          username: proof_payload.account,
        })

        await appContainer.self.authSessions.insertOne({
          id: id,
          type: 'singleton',
          sub: `singleton/${proof_payload.account}`,
          date: new Date(),
          expires: moment().add('1', 'month').toDate(),
        })

        return {
          access_token,
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
        await appContainer.self.hiveAccountsDb.insertOne({
          status: "requested",
          username,
          keys_requested: false,
          created_by: null,
          requested_at: new Date(),
          request_type: 'otp-login',
          created_at: new Date(),
          secret: body.secret
        })
        // const accountCreation = await createAccountWithAuthority(
        //   username,
        //   process.env.ACCOUNT_CREATOR
        // )

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



    const existingRecord = await appContainer.self.usersDb.findOne({
      email
    })

    if(existingRecord) {
      throw new HttpException(
        { reason: 'Email Password account already created!' },
        HttpStatus.BAD_REQUEST,
      ) 
    } else {
      const email_code = uuid()
      
      await appContainer.self.usersDb.insertOne({
        status: 'unverified',
        email_status: 'unverified',
        user_id: uuid(),
        email: req.body.email,
        email_code,
        auth_methods: {
          password: {
            value: hashedPassword
          }
        },
        type: 'multi',
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: new Date(),
        password_reset_at: null
      })
      mg.messages().send(
        {
          from: `test@${process.env.MAIL_GUN_DOMAIN}`,
          to: req.body.email,
          subject: 'test registration',
          html: `test registration. Click <a href=\"http://${process.env.PUBLIC_CALLBACK_URL || "localhost:4569"}/api/v1/auth/verifyemail?code=${email_code}\">here</a> to verify email address.`,
        },
        (err, info) => {
          console.log('[mailer]', 'confirm_signup', err, info)
        },
      )
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
    // console.log(verifyCode)

    await appContainer.self.usersDb.findOneAndUpdate(
      {
        email_code: verifyCode,
      },
      {
        $set: {
          email_status: 'verified',
        },
      },
    )
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
    const existingAcocunt = await appContainer.self.hiveAccountsDb.findOne({
      created_by: req.user.user_id,
    })
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
        const accountCreation = await createAccountWithAuthority(
          req.body.username,
          process.env.ACCOUNT_CREATOR,
        )
        //Here will be thrown if failed at this point
  
        await appContainer.self.hiveAccountsDb.insertOne({
          status: 'created',
          username: req.body.username,
          keys_requested: false,
          created_by: req.user.user_id,
          requested_at: new Date(),
          created_at: new Date(),
        })
  
        
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
    return await HiveClient.broadcast.comment(
      {
        parent_author,
        parent_permlink,
        author,
        permlink: Crypto.randomBytes(8).toString('base64url').toLowerCase().replace('_', ''),
        title: '',
        body,
        json_metadata: JSON.stringify({
          app: 'threespeak.beta/0.1',
        }),
      },
      DHive.PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING),
    )
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
  async linkAccount(@Body() data: LinkAccountPost, @Request() req: any) {
    const { user_id } = req.user
    const linkedAccount = await appContainer.self.linkedAccountsDb.findOne({
      user_id: user_id,
      account: data.username,
    })
    if (!linkedAccount) {
      const challenge = uuid()
      await appContainer.self.linkedAccountsDb.insertOne({
        status: 'unverified',
        user_id: user_id,
        account: data.username,
        network: 'HIVE',
        challenge,
        linked_at: new Date(),
        verified_at: null,
        type: 'native'
      })

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
    const { memo } = data
    console.log(memo)

    const decoded = hive.memo.decode(process.env.DELEGATED_ACCOUNT_POSTING, memo)
    const message = JSON.parse(decoded.substr(1))
    const pubKeys = hive.memo.getPubKeys(memo)

    const [account] = await HiveClient.database.getAccounts([message.account])
    console.log(account[message.authority], pubKeys)

    let signatureValid = false

    for (const key_auth of account[message.authority].key_auths) {
      if (key_auth[0] === pubKeys[0]) {
        signatureValid = true
      }
    }

    const identityChallenge = await appContainer.self.linkedAccountsDb.findOne({
      challenge: message.message,
    })
    console.log(signatureValid, account, message.message, identityChallenge)
    if (signatureValid === true) {
      if (identityChallenge.account === account.name) {
        await appContainer.self.linkedAccountsDb.updateOne(
          {
            _id: identityChallenge._id,
          },
          {
            $set: {
              status: 'verified',
            },
          },
        )
        return {
          ok: true
        }
      } else {
        throw new HttpException({ reason: 'Incorrect signing account' }, HttpStatus.BAD_REQUEST)
      }
    } else {
      throw new HttpException({ reason: 'Incorrect signature' }, HttpStatus.BAD_REQUEST)
    }
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
    // console.log(data)
    const delegatedAuth = await appContainer.self.delegatedAuthority.findOne({
      // to: 'threespeak.beta',
      // from: 'vaultec'
    })
    if (!!delegatedAuth) {
      try {
        const out = await HiveClient.broadcast.vote(
          {
            author: data.author,
            permlink: data.permlink,
            voter: 'vaultec',
            weight: 10_000,
          },
          DHive.PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING),
        )
        // console.log(out)
        return out
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
