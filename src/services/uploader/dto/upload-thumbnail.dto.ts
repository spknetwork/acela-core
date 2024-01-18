import { ApiProperty } from "@nestjs/swagger"

export class UploadThumbnailUploadDto {

  @ApiProperty({
    description: "ID of video"
  })
  video_id: string
  @ApiProperty({
    description: 'Attachments',
    type: 'array',
    items: {
      type: 'file',
      items: {
        type: 'string',
        format: 'binary',
      },
    },
  })
  file: any
}