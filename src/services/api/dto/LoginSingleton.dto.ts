import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import crypto from 'crypto';
import { PrivateKey } from '@hiveio/dhive';

const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString('hex'));
const message = { account: 'sisygoboom', ts: Date.now() };
const signature = privateKey
  .sign(crypto.createHash('sha256').update(JSON.stringify(message)).digest())
  .toString();

/**
 * Data Transfer Object (DTO) for login singleton hive
 */
export class LoginSingletonHiveDto {
  /**
   * Proof payload object containing timestamp and account information
   */
  @IsNotEmpty()
  @ApiProperty({
    description: 'Proof payload object containing timestamp and account information',
    type: 'object',
    properties: {
      ts: {
        type: 'number',
        description: 'Timestamp of the proof payload',
        example: Date.now(),
      },
      account: {
        type: 'string',
        description: 'Account associated with the proof payload',
        example: 'user123',
      },
    },
    example: message,
  })
  proof_payload: {
    ts: number;
    account: string;
  };

  /**
   * Proof string for authentication
   */
  @IsNotEmpty()
  @ApiProperty({
    description: 'Proof string for authentication',
    type: 'string',
    example: signature,
  })
  proof: string;
}

export class LoginSingletonDidDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Did of the account',
    default: 'test-did',
  })
  did: string;

  @IsNotEmpty()
  @ApiProperty({
    description:
      'Issued at (timestamp) - milliseconds denominated timestamp representing when the token was issued',
    default: Date.now(),
  })
  iat: number;
}
