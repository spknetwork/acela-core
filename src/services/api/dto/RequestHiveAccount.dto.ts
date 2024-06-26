import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class RequestHiveAccountDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Username for the new Hive account',
    default: 'myUsername123',
  })
  username: string;
}
