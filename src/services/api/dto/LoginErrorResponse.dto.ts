import { ApiProperty } from '@nestjs/swagger';
import { LoginErrorReasonEnum, LoginErrorPossibles } from '../types';

export class LoginErrorResponseDto {
  @ApiProperty({
    description: 'Reason for failed response',
    enum: LoginErrorReasonEnum,
  })
  reason: 'Unsupported network type' | 'Invalid Signature';

  @ApiProperty({
    description: 'Error type enum - use this for application logic',
    enum: LoginErrorPossibles,
    isArray: false,
  })
  errorType: LoginErrorPossibles;
}
