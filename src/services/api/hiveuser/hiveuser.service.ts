import { Injectable } from '@nestjs/common'
import { appContainer } from '..';
import { Client } from '@hiveio/dhive'

export type User = any

@Injectable()
export class HiveuserService {
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
    const hiveUser = await appContainer.self.hiveUserForDAppsDb.findOne(query);
    if (hiveUser === undefined || hiveUser === null) {
      return false;
    }
    if (hiveUser.banned === true) {
      return false;
    }
    return true;
  }
}
