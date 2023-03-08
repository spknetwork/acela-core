import { Injectable } from '@nestjs/common'
import { appContainer } from '..';
import { Client } from '@hiveio/dhive'
import { JwtService } from '@nestjs/jwt'
import hive from "@hiveio/hive-js";

import 'dotenv/config'

export type User = any

@Injectable()
export class HiveuserService {
  constructor(private readonly jwtService: JwtService){}

  async findOne(hiveusername: string): Promise<User | undefined> {
    const client = new Client([
      'https://api.hive.blog',
      'https://api.hivekings.com',
      'https://anyx.io',
      'https://api.openhive.network',
    ])
    var users = await client.database.getAccounts([hiveusername])
    return users[0]
  }

  async isValidUser(hiveusername: string): Promise<boolean> {
    const query = { userid: hiveusername };
    try {
    const hiveUser = await appContainer.self.userForDAppsDb.findOne(query);
    if (hiveUser === undefined || hiveUser === null) {
      await appContainer.self.userForDAppsDb.insertOne({
        username: hiveusername,
        network: 'hive',
        banned: false,
      })
      return true;
    }
    if (hiveUser.banned === true) {
      return false;
    }
    return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  getEncodedMemo(hiveusername: string, user: User): string {
    var dataToSign = { userid: hiveusername, network: 'hive', banned: false }
    var access_token = this.jwtService.sign(dataToSign)
    const publicKey = user.posting.key_auths[0][0]
    hive.api.setOptions({
      useAppbaseApi: true,
    });
    return hive.memo.encode(process.env.HIVE_PRIVATE_KEY, publicKey, `#${access_token}`)
  }
}
