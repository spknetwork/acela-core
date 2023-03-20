import { Test, TestingModule } from '@nestjs/testing';
import { HiveauthuserController } from './hiveauthuser.controller';

describe('HiveauthuserController', () => {
  let controller: HiveauthuserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HiveauthuserController],
    }).compile();

    controller = module.get<HiveauthuserController>(HiveauthuserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
