
import { Injectable } from '@nestjs/common';
import { UsersService } from '../../../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrivateKey } from '@hiveio/dhive'; 

const dhive = require('@hiveio/dhive');
const client = new dhive.Client('https://api.hive.blog');

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(username);
    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.user_name, sub: user._id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(user_name: any, password: any) {
    const existing_user = await this.usersService.findOne(user_name);
    if (!existing_user) {
      this.usersService.registerNewUser(user_name, password)
      return '200: User Created'
    } else {
      return '303: User exists'
    }
  }

  async verifyPosting(hive_user: any, private_posting_key: any) {
    const props = await client.database.getDynamicGlobalProperties();
    const expireTime = 60 * 1000; //1 min
    const head_block_number = props.head_block_number;
    const head_block_id = props.head_block_id;
    const op = {
      ref_block_num: head_block_number,
      ref_block_prefix: Buffer.from(head_block_id, 'hex').readUInt32LE(4),
      expiration: new Date(Date.now() + expireTime)
          .toISOString()
          .slice(0, -5),
      operations: [
          [
              'custom_json',
              {
                  required_auths: [],
                  required_posting_auths: [hive_user],
                  id: 'verifyPosting',
                  json:
                      '["verifyPosting",{"account":"' +
                      hive_user +
                      '","author":"test","permlink":"test"}]',
              },
          ],
      ], 
      extensions: [],
    };
    const stx = await client.broadcast.sign(op, PrivateKey.fromString(private_posting_key));
    console.log(stx);
    const res = await client.broadcast.send(stx);

    return res;
  }
}