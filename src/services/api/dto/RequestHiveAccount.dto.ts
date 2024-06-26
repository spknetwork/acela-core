import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RequestHiveAccountDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Did of the account',
    default: 'test-did',
  })
  username: string;
}
