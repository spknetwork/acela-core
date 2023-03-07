import { Controller, Get, Param } from '@nestjs/common'
import { HiveuserService } from './hiveuser.service';

@Controller('/api/v1/hiveuser')
export class HiveuserController {
  constructor(private readonly hiveuserService: HiveuserService) {}

  @Get('/getInfo/:username')
  getInfo(@Param('username') username: string) {
    return this.hiveuserService.findOne(username);
  }
}
