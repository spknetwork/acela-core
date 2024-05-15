import { ApiProperty } from '@nestjs/swagger';

export class StartEncodeDto {
  @ApiProperty({
    description: 'ID of the upload',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  upload_id: string;

  @ApiProperty({
    description: 'Video ID',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  video_id: string;

  @ApiProperty({
    description: 'permlink of the post',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  permlink: string;
}
