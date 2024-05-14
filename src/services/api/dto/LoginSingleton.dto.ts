import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginSingletonHiveDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Username of the account',
    default: 'test-account',
  })
  username?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Network of the identity; Can be HIVE or CERAMIC',
    default: 'HIVE',
  })
  network: string;

  @IsNotEmpty()
  @ApiProperty({})
  authority_type?: string;
  proof_payload: string;
  proof: string;
}

export class LoginSingletonDidDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Username of the account',
    default: 'test-account',
  })
  username?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Network of the identity; Can be HIVE or CERAMIC',
    default: 'HIVE',
  })
  network: string;

  @IsNotEmpty()
  @ApiProperty({})
  authority_type?: string;
  proof_payload: string;
  proof: string;
}
