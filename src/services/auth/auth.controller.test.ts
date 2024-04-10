import { UserAccountModule } from '../../repositories/userAccount/user-account.module';
import { SessionModule } from '../../repositories/session/session.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { HiveModule } from '../../repositories/hive/hive.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from './auth.module';
import { HiveAccountModule } from '../../repositories/hive-account/hive-account.module';
import { UserModule } from '../../repositories/user/user.module';
const jwt = require('jsonwebtoken');
// const { generateKeyPair } = require('crypto');

// const generateKeyPair = () = generateKeyPair('ec', {
//   namedCurve: 'prime256v1', // Use the same curve name as OpenSSL
//   publicKeyEncoding: {
//     type: 'spki',
//     format: 'pem'
//   },
//   privateKeyEncoding: {
//     type: 'pkcs8',
//     format: 'pem'
//   }
// }, (err: any, publicKey: string, privateKey: string) => {
//   if (!err) {
//     return { publicKey, privateKey }
//   } else {
//     console.log('Error:', err);
//   }
// });

describe('AuthController', () => {
  let authService: AuthService;
  let authController: AuthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        MongooseModule.forRoot(`${(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017')}/3speakAuth${process.env.CORE_MONGODB_PARAMS}`, {
          connectionName: '3speakAuth'
        }),
        MongooseModule.forRoot(`${(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017')}/acela-core${process.env.CORE_MONGODB_PARAMS}`, {
          connectionName: 'acela-core'
        }),
        MongooseModule.forRoot(`${(process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017')}/threespeak${process.env.CORE_MONGODB_PARAMS}`, {
          connectionName: 'threespeak'
        }),
        UserAccountModule, 
        SessionModule,
        HiveAccountModule,
        UserModule,
        JwtModule,
        HiveModule,
        EmailModule,
        AuthModule
      ],
      controllers: [AuthController],
      providers: [AuthService]
    }).compile()

    authController = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get<AuthService>(AuthService);
  });

  describe('Login using did', () => {
    it('Should fully execute a login', async () => {

      // Your payload data
      const payload = {
        sub: "1234567890",
        name: "John Doe",
        iat: 1516239022
      };

      // Private key for RS256 or secret for HS256
      const privateKey = 'your-256-bit-secret';

      // Sign the JWT
      const token = jwt.sign(payload, privateKey, { algorithm: 'HS256'});

      console.log(token);
      

      expect(await authController.loginSingletonReturn({ network: 'did', proof_payload: 'thing', proof: 'string' }, token)).toBe({});
    });
  });
});