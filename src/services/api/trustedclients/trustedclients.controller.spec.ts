import { Test, TestingModule } from '@nestjs/testing';
import { TrustedclientsController } from './trustedclients.controller';

describe('TrustedclientsController', () => {
  let controller: TrustedclientsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrustedclientsController],
    }).compile();

    controller = module.get<TrustedclientsController>(TrustedclientsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
