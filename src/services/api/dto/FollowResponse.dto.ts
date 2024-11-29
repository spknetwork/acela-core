import { TransactionConfirmation } from '@hiveio/dhive';
import { ApiProperty } from '@nestjs/swagger';

export class FollowResponseDto {
  @ApiProperty({
    default: 'f555e5e690aefa99f5d6c1fe47c08db6ad79af1f',
  })
  action: string;

  @ApiProperty({
    default: {
      id: 'id',
      block_num: 1,
      trx_num: 1,
      expired: false,
    },
  })
  result: TransactionConfirmation;
}
