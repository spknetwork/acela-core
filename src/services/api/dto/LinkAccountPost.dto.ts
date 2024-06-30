import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class LinkAccountPostDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Hive username for the account being linked',
    type: 'string',
  })
  username: string;

  @IsNotEmpty()
  @ApiProperty({
    description:
      'A signed message. The signed message should read "I am the owner of @[ACCOUNT_NAME_HERE]" with capitalisation preserved and the @ included.',
    example:
      'jksodjfikfjskljsdkl ("I am the owner of @hiveaccount" signed with the private key of the account)',
    type: 'string',
  })
  proof: string;
}
