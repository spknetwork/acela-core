import { Test, TestingModule } from '@nestjs/testing';
import { HiveuserController } from './hiveuser.controller';

describe('HiveuserController', () => {
  let controller: HiveuserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HiveuserController],
    }).compile();

    controller = module.get<HiveuserController>(HiveuserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
