import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginSingletonHiveDto {
  @IsNotEmpty()
  @ApiProperty({})
  proof_payload: {
    ts: number;
    account: string;
  };
  @IsNotEmpty()
  @ApiProperty({})
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
