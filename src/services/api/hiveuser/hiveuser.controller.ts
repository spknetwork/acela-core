import { Controller, Get, Headers, HttpException, HttpStatus, Param, UseGuards } from '@nestjs/common'
import { HiveuserService } from './hiveuser.service'
import { AuthGuard } from '@nestjs/passport';

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

  // @UseGuards(AuthGuard('jwt'))
  @Get('/getUInfo/:username')
  async verifyToken(
    @Headers() headers,
    @Param('username') username: string,
  ) {
    const token = headers['authorization'].replace("Bearer ", "");
    const result = this.hiveuserService.validateAccessToken(token);
    console.log(result);
    return { hello: "world" };
  }
}
