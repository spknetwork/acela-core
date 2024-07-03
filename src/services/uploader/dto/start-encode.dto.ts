import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class StartEncodeDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID of the upload',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  upload_id: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Video ID',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  video_id: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'permlink of the post',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  permlink: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'Linked hive username you want to post with',
    default: 'test',
  })
  username: string;
}
