import { Controller, Get, Param, Res } from '@nestjs/common'
import { HiveuserService } from './hiveuser.service';
import {Response} from 'express';

@Controller('/api/v1/hiveuser')
export class HiveuserController {
  constructor(private readonly hiveuserService: HiveuserService) {}

  @Get('/getInfo/:username')
  async getInfo(@Param('username') username: string, @Res() res: Response) {
    const value = await this.hiveuserService.findOne(username);
    console.log(value);
    if (value === undefined || value === null) {
      return res.status(404).send({ message: 'No such hive user found.' });
    }
    return res.send(value);
  }
}
