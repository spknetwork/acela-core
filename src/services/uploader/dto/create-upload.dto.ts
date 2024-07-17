import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadDto {
  @ApiProperty({
    description: 'Linked hive username you want to post with',
    default: 'test',
  })
  username?: string;
}
