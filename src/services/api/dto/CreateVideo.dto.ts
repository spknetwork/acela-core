import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CreateVideoDto {
  @IsNotEmpty()
  @ApiProperty({
    default: 'hiveaccount',
  })
  account: string;
}
