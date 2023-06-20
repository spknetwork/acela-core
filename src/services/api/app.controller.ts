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
import moment from 'moment'
import { authenticator } from 'otplib'

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
  username: string

  @IsNotEmpty()
  network: string

  @IsNotEmpty()
  authority_type: string

  proof_payload: string
  proof: string
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
  async login(@Request() req) {
    return this.authService.login(req.user)
  }

  // @UseGuards(AuthGuard('local'))
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
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    // return this.authService.login(req.user)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/auth/check')
  async checkAuth(@Request() req) {
    console.log('user details check', req.user)
  }

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
          jwt
        }
      } else {
        throw new HttpException({
          reason: "Invalid OTP code"
        }, HttpStatus.BAD_REQUEST)
      }

    } else {
      throw new HttpException(
        { reason: 'Hive account with the requested name already exists' },
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

  @UseGuards(AuthGuard('local'))
  @Post('/auth/register')
  async register(@Request() req) {
    const password = req.body.password
    const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10))

    const email_code = uuid()
    mg.messages().send(
      {
        from: `test@${process.env.MAIL_GUN_DOMAIN}`,
        to: req.body.email,
        subject: 'test registration',
        html: `test registration. Click <a href=\"http://localhost:4569/api/v1/auth/verifyemail?code=${email_code}\">here</a> to verify email address.`,
      },
      (err, info) => {
        console.log('[mailer]', 'confirm_signup', err, info)
      },
    )

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
    // return this.authService.login(req.user);
  }

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

      throw accountCreation
    } else {
      throw new HttpException(
        { reason: 'Hive account with the requested name already exists' },
        HttpStatus.BAD_REQUEST,
      )
    }
  }

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
        permlink: Crypto.randomBytes(8).toString('base64url').toLowerCase(),
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
      } else {
        throw new HttpException({ reason: 'Incorrect signing account' }, HttpStatus.BAD_REQUEST)
      }
    } else {
      throw new HttpException({ reason: 'Incorrect signature' }, HttpStatus.BAD_REQUEST)
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @UseGuards(RequireHiveVerify)
  @Post(`/hive/vote`)
  async votePost(@Body() data: any) {
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
