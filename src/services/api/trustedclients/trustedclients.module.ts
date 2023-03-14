import { Module } from '@nestjs/common';
import { TrustedclientsService } from './trustedclients.service';
import { TrustedclientsController } from './trustedclients.controller';

@Module({
  providers: [TrustedclientsService],
  controllers: [TrustedclientsController]
})
export class TrustedclientsModule {}
