import { Controller, Get, Headers, Param } from '@nestjs/common'
import { HiveauthuserService } from './hiveauthuser.service'
// import { HiveuserService } from '../hiveuser/hiveuser.service'
import * as DHive from '@hiveio/dhive'
import { cryptoUtils } from '@hiveio/dhive'

@Controller('/api/v1/hiveauthuser')
export class HiveauthuserController {
  constructor(
    // private readonly hiveuserService: HiveuserService,
    private readonly hiveauthuserService: HiveauthuserService,
  ) {}

  // @Get('/dataToSign/:username')
  // async getDataToSign(@Param('username') username: string) {
  //   // this is necessary because if user is banned, service will take care of throwing an error
  //   await this.hiveuserService.getHiveUserInfo(username)
  //   // if user is not banned, we return the data to be signed with posting key
  //   return {
  //     lead: 'vaultec',
  //     dev: 'sagar',
  //     community: '3speak',
  //     user: username,
  //     // ts: Date.now()
  //   }
  // }

  verifyHiveMessage(message: string, signature: string, pubKey: string): boolean {
    const publicKey = DHive.PublicKey.fromString(pubKey)
    const buffMessage = Buffer.from(message);
    const buffSignature = Buffer.from(signature, 'hex');
    const signatureFromBuffer = DHive.Signature.fromBuffer(buffSignature);
    const sigValidity = publicKey.verify(
      buffMessage,
      signatureFromBuffer
    )
    if (sigValidity) {
      return true
    }
    return false
  }

  @Get('/accessToken/:username/:signature')
  async getAccessToken(@Param('username') username: string, @Param('signature') signature: string) {
    // const userInfo = await this.hiveuserService.getHiveUserInfo(username)
    // const publicKey = userInfo.posting.key_auths[0][0]
    const publicKey = "STM647VHLeLEJqFdhfEr7C8ViNZxVJf4CRHZvzt1Ch9P5TvPXmijN"
    const challenge_data = {
      key_type: 'posting',
      challenge: JSON.stringify({
        lead: 'valutec',
        dev: 'sagar',
        community: '3speak',
      }),
    }
    const message =
      'U2FsdGVkX1+eN3gNj1IkjoO865/9Bc9fd6sY4rAfsNuSL9rOPOZCUoy9563GWw9quGJpbKLIscfSBKrFUZv7lbfj0jjDOH6oWdaoTEXeSinh/iKQf96r6H5WFNBFsTn1+Jr2NZ+NRWeFDumu2qWxjfdgYXsl4VyvpGTNb0OHSJNVa+Xe35SbdUIIMSPTtjD9T+HOdSmUX8Q8bVPf5U08K000MmbCBIQiRuY89H08MxOckJxStrFnv55Wv8TXh4yo6RbOP1QvE1B1R+gDDgAoSdrNYiY1pXfLqJYdjaprQMGg0017DWzZKdyhHaiHQ+xP'
    const signedData =
      '1f2a020ac2bf253e363c20ce0d2df4923636f85cc2f39c4aadc73835df0c236a9e3d4445c76dbb541fdb4752f9f5937fba9f89825590e258fa10727820e16ca2b2'
    const result = this.verifyHiveMessage(message, signedData, publicKey)
    console.log(result)
    return { result }
  }
}
