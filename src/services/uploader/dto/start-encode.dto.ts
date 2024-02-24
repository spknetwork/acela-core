import { ApiProperty } from "@nestjs/swagger";

export class StartEncodeDto {
  @ApiProperty({
    description: 'ID of the upload',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  upload_id: string
}