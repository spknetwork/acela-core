import {
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common'
import { HiveuserService } from './hiveuser.service'
import { AuthGuard } from '@nestjs/passport'

@Controller('/api/v1/hiveuser')
export class HiveuserController {
  constructor(private readonly hiveuserService: HiveuserService) {}

  async getHiveUserInfo(username: string): Promise<any> {
    const hiveUserInfo = await this.hiveuserService.findOne(username)
    if (hiveUserInfo === undefined || hiveUserInfo === null) {
      throw new HttpException(
        `No such hive user found with name - ${username}`,
        HttpStatus.NOT_FOUND,
      )
    }
    const isValidUser = await this.hiveuserService.isValidUser(username)
    if (!isValidUser) {
      throw new HttpException(`Hive user - ${username} - is banned`, HttpStatus.FORBIDDEN)
    }
    return hiveUserInfo
  }

  @Get('/getHiveInfo/:username')
  async getHiveInfo(@Param('username') username: string) {
    return await this.getHiveUserInfo(username)
  }

  @Get('/getMemo/:username')
  async getMemo(@Param('username') username: string) {
    const hiveUserInfo = await this.getHiveUserInfo(username)
    var encryptedToken = this.hiveuserService.getEncodedMemo(username, hiveUserInfo)
    return { access_token: encryptedToken }
  }

  @Get('/getUserInfo/:username')
  async getUserInfo(@Headers() headers, @Param('username') username: string) {
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
    const userInfo = await this.hiveuserService.getUInfo(userid)
    return userInfo
  }
}
