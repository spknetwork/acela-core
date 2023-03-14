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

  // With this, we'll provide complete User info 
  // from User schema
  @Get('/getUserInfo/:username')
  async getUserInfo(@Headers() headers, @Param('username') username: string) {
    const userid = await this.hiveuserService.validateHeaderAndUserName(headers, username)
    return await this.hiveuserService.getUInfo(userid)
  }

  @Get('/videos/:username')
  async getVideos(@Headers() headers, @Param('username') username: string) {
    const userid = await this.hiveuserService.validateHeaderAndUserName(headers, username)
    const videos = await this.hiveuserService.getUInfo(userid)
    return videos
  }
}
