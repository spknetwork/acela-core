import { Module } from '@nestjs/common'
import { HiveuserController } from './hiveuser.controller'
import { HiveuserService } from './hiveuser.service'

@Module({
  providers: [HiveuserService],
  exports: [HiveuserService],
  controllers: [HiveuserController],
})
export class HiveuserModule {}
