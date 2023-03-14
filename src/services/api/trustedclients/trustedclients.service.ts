import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import AES from 'crypto-js/aes'
import 'dotenv/config'

@Injectable()
export class TrustedclientsService {
  constructor(private readonly jwtService: JwtService) {}

  getEncodedMemo(client: string, username: string): string {
    const clients = process.env.TRUSTED_CLIENTS.split(',')
    const keys = process.env.TRUSTED_CLIENTS.split(',')
    const indexOfClient = clients.indexOf(client)
    if (indexOfClient <= -1) {
      throw new HttpException(
        `No such trusted client found with name - ${client}`,
        HttpStatus.NOT_FOUND,
      )
    }
    if (keys.length <= indexOfClient) {
      throw new HttpException(
        `Key not found for trusted client with name - ${client}`,
        HttpStatus.NOT_FOUND,
      )
    }
    const key = keys[indexOfClient]
    var dataToSign = { userid: username, network: 'hive', banned: false }
    var access_token = this.jwtService.sign(dataToSign)
    var encrypted_access_token = AES.encrypt(access_token, key).toString()

    /*
    // Code to decrypt the text for front-ends
    var cryptoJs = require("crypto-js")
    var AES = require("crypto-js/aes");
    AES.decrypt(access_token, key).toString(cryptoJs.enc.Utf8);
    */

    return encrypted_access_token
  }
}
