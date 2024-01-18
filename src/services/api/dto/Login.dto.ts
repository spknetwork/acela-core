import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    default: "test-account@fakedomain.com"
  })
  username: string;

  @ApiProperty({
    default: "user-generated-password"
  })
  password: string;
}
