import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginSingletonDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Username of the account',
    default: "test-account",
  })
  username: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Network of the identity; Can be HIVE or CERAMIC',
    default: "HIVE",
  })
  network: string;

  @IsNotEmpty()
  @ApiProperty({})
  authority_type: string;

  proof_payload: string;
  proof: string;
}
