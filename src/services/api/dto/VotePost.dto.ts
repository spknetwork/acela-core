import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class VotePostDto {
  @IsNotEmpty()
  @ApiProperty({
    default: 'sagarkothari88',
  })
  author: string;

  @IsNotEmpty()
  @ApiProperty({
    default: 'actifit-sagarkothari88-20230211t122818265z',
  })
  permlink: string;

  @IsNotEmpty()
  @ApiProperty({
    default: 10000,
  })
  weight: number;
}
