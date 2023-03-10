import { Injectable } from '@nestjs/common'
import { appContainer } from '..'
import { Client } from '@hiveio/dhive'
import { JwtService } from '@nestjs/jwt'
import hive from '@hiveio/hive-js'
import { UserForDApps } from '../../../types/userfordapps'
import { Video } from '../../../types/video'

import 'dotenv/config'

export type User = any

@Injectable()
export class HiveuserService {
  constructor(private readonly jwtService: JwtService) {}

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
    const query = { username: hiveusername, network: 'hive' }
    try {
      const hiveUser = await appContainer.self.userForDAppsDb.findOne(query)
      if (hiveUser === undefined || hiveUser === null) {
        await appContainer.self.userForDAppsDb.insertOne({
          username: hiveusername,
          network: 'hive',
          banned: false,
        })
        return true
      }
      if (hiveUser.banned === true) {
        return false
      }
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  async getUInfo(hiveusername: string): Promise<UserForDApps | null> {
    const query = { username: hiveusername, network: 'hive' }
    return await appContainer.self.userForDAppsDb.findOne(query);
  }

  getEncodedMemo(hiveusername: string, user: User): string {
    var dataToSign = { userid: hiveusername, network: 'hive', banned: false }
    var access_token = this.jwtService.sign(dataToSign)
    const publicKey = user.posting.key_auths[0][0]
    hive.api.setOptions({
      useAppbaseApi: true,
    })
    return hive.memo.encode(process.env.VOTER_ACCOUNT_POSTING, publicKey, `#${access_token}`)
  }

  async getVideos(owner: string): Promise<Video[]> {
    const query = { owner: owner, network: 'hive' }
    const videos = await appContainer.self.videosDb.find(query);
    const dbVideos = videos.map(v => v as Video).toArray();
    return dbVideos;
  }

  validateAccessToken(access_token: string): any {
    return this.jwtService.verify(access_token)
  }
}
