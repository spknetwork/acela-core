import { ApiProperty } from '@nestjs/swagger';

export class VotePostResponseDto {
  @ApiProperty({
    default: "f555e5e690aefa99f5d6c1fe47c08db6ad79af1f"
  })
  id: string;
}
