import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UnlinkAccountPostDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Hive username for the account being unlinked',
    type: 'string',
  })
  username: string;
}
