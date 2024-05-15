import { ApiProperty } from '@nestjs/swagger';

export class UpdateUploadDto {
  @ApiProperty({
    description: 'Video Identifier',
    default: 'some-unique-id-generated-in-create_upload-api',
  })
  video_id: string;

  @ApiProperty({
    description: 'permlink of hive-post generated during create_upload API',
    default: 'permlink',
  })
  permlink: string;

  @ApiProperty({
    description: 'Title of the post',
    default: 'Your video title',
  })
  title: string;

  @ApiProperty({
    description: 'Description of the post',
    default: 'This video is a test video. Here we can put a description',
  })
  body: string;

  @ApiProperty({
    description: 'Tags for the post',
    default: ['threespeak', 'acela-core'],
  })
  tags: string[];

  @ApiProperty({
    description: 'Community',
    default: 'hive-181335',
  })
  community: string;

  @ApiProperty({
    description: 'json string of beneficiaries array',
    default: '[]',
  })
  beneficiaries: string;

  @ApiProperty({
    description: 'Language of the video in ISO 639-1 format',
    default: 'en',
  })
  language: string;

  @ApiProperty({
    description: 'original file name',
    default: 'bla-bla-bla.mp4',
  })
  originalFilename: string;

  @ApiProperty({
    description: 'file name which TUSd provided',
    default: 'e1e7903087f9c39ac1645d69f5bb96cd',
  })
  filename: string;

  @ApiProperty({
    description: 'file size in bytes number',
    default: '32330',
  })
  size: number;

  @ApiProperty({
    description: 'Video duration in seconds',
    default: '98',
  })
  duration: number;
}
