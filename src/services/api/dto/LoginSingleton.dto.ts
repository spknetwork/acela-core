import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginSingletonHiveDto {
  @IsNotEmpty()
  @ApiProperty({})
  authority_type?: string;
  proof_payload: string;
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
