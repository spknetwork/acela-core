import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
        example: 1625158800,
      },
      account: {
        type: 'string',
        description: 'Account associated with the proof payload',
        example: 'user123',
      },
    },
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
    example: 'proofString123',
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
