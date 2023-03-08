import { Controller, Get, Headers, HttpException, HttpStatus, Param, Res } from '@nestjs/common'
import { HiveuserService } from './hiveuser.service'

@Controller('/api/v1/hiveuser')
export class HiveuserController {
  constructor(private readonly hiveuserService: HiveuserService) {}

  async getUserInfo(username: string): Promise<any> {
    const hiveUserInfo = await this.hiveuserService.findOne(username)
    if (hiveUserInfo === undefined || hiveUserInfo === null) {
      throw new HttpException(`No such hive user found with name - ${username}`, HttpStatus.NOT_FOUND)
    }
    const isValidUser = await this.hiveuserService.isValidUser(username)
    if (!isValidUser) {
      throw new HttpException(`Hive user - ${username} - is banned`, HttpStatus.FORBIDDEN)
    }
    return hiveUserInfo;
  }

  @Get('/getInfo/:username')
  async getInfo(@Param('username') username: string) {
    return await this.getUserInfo(username)
  }

  @Get('/getMemo/:username')
  async getMemo(@Param('username') username: string) {
    const hiveUserInfo = await this.getUserInfo(username)
    var encryptedToken = this.hiveuserService.getEncodedMemo(username, hiveUserInfo)
    return { access_token: encryptedToken };
  }

  @Get('/verifyToken/:username')
  async verifyToken(
    @Headers() headers: Record<string, string>,
    @Param('username') username: string,
  ) {
    const hiveUserInfo = await this.hiveuserService.findOne(username)
    console.log(hiveUserInfo)
    if (hiveUserInfo === undefined || hiveUserInfo === null) {
      throw new HttpException(`No such hive user found with name - ${username}`, HttpStatus.NOT_FOUND)
    }
    const isValidUser = await this.hiveuserService.isValidUser(username)
    if (!isValidUser) {
      throw new HttpException(`Hive user - ${username} - is banned`, HttpStatus.FORBIDDEN)
    }
    return "";
  }
}
