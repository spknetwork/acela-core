import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common'
import { HiveuserService } from './hiveuser.service'

@Controller('/api/v1/hiveuser')
export class HiveuserController {
  constructor(private readonly hiveuserService: HiveuserService) {}

  // This is a test service
  @Get('/getHiveInfo/:username')
  async getHiveInfo(@Param('username') username: string) {
    return await this.hiveuserService.getHiveUserInfo(username)
  }

  // Get Encoded memo of a JWT token
  @Get('/getMemo/:username')
  async getMemo(@Param('username') username: string) {
    const hiveUserInfo = await this.hiveuserService.getHiveUserInfo(username)
    var encryptedToken = this.hiveuserService.getEncodedMemo(username, hiveUserInfo)
    return { access_token: encryptedToken }
  }

  async validateHeaderAndUserName(@Headers() headers, @Param('username') username: string): Promise<string> {
    const token = headers['authorization'].replace('Bearer ', '')
    const result = this.hiveuserService.validateAccessToken(token)
    if (!result) {
      throw new HttpException(`Invalid token.`, HttpStatus.NOT_FOUND)
    }
    const userid = result.userid
    if (username !== userid) {
      throw new HttpException(`Invalid username.`, HttpStatus.NOT_FOUND)
    }
    const isValidUser = await this.hiveuserService.isValidUser(username)
    if (!isValidUser) {
      throw new HttpException(`Hive user - ${username} - is banned`, HttpStatus.FORBIDDEN)
    }
    return userid;
  }

  @Get('/getUserInfo/:username')
  async getUserInfo(@Headers() headers, @Param('username') username: string) {
    const userid = await this.validateHeaderAndUserName(headers, username)
    return await this.hiveuserService.getUInfo(userid)
  }

  @Get('/videos/:username')
  async getVideos(@Headers() headers, @Param('username') username: string) {
    const userid = await this.validateHeaderAndUserName(headers, username)
    const videos = await this.hiveuserService.getUInfo(userid)
    return videos
  }
}
