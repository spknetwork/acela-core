import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class FollowDto {
  @IsNotEmpty()
  @ApiProperty({
    default: 'test-2',
  })
  following: string;

  @ApiProperty({
    default: 'test-1',
  })
  follower?: string;
}
