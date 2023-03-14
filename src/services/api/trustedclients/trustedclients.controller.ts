import {
  Controller,
  Get,

  Param,
} from '@nestjs/common'
import { TrustedclientsService } from './trustedclients.service'
import { HiveuserService } from '../hiveuser/hiveuser.service'

@Controller('/api/v1/trustedclients')
export class TrustedclientsController {
  constructor(
    private readonly trustedClientsService: TrustedclientsService,
    private readonly hiveuserService: HiveuserService,
  ) {}

  // Get Encoded memo of a JWT token
  @Get('/:client/getMemo/:username')
  async getMemo(@Param('username') username: string, @Param('client') client: string) {
    // just to make sure that 
    // 1. user is a valid hive-user
    // 2. user is not banned
    const hiveUserInfo = await this.hiveuserService.getHiveUserInfo(username)
    console.log(`User ${username} public key - ${hiveUserInfo.posting.key_auths[0][0]}`);

    // encrypt token with shared secret between trusted clients.
    var encryptedToken = this.trustedClientsService.getEncodedMemo(client, username)
    return { access_token: encryptedToken }
  }
}
