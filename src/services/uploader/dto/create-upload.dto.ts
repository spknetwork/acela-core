import { ApiProperty } from "@nestjs/swagger"

export class CreateUploadDto {
  @ApiProperty({
    description: 'Title of the post',
    default: "Your video title",
  })
  title: string

  @ApiProperty({
    description: 'Description of the post',
    default: "This video is a test video. Here we can put a description",
  })
  body: string

  @ApiProperty({
    description: 'Tags for the post',
    default: ['threespeak', 'acela-core'],
  })
  tags: string[]

  @ApiProperty({
    description: 'Community',
    default: 'hive-181335',
  })
  community: string

  @ApiProperty({
    description: 'Language of the video in ISO 639-1 format',
    default: 'en',
  })
  language: string
}