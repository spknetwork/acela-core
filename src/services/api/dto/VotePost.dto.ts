import { ApiProperty } from '@nestjs/swagger';

export class VotePostDto {
  @ApiProperty({
    default: "sagarkothari88"
  })
  author: string;

  @ApiProperty({
    default: "actifit-sagarkothari88-20230211t122818265z"
  })
  permlink: string;
}
