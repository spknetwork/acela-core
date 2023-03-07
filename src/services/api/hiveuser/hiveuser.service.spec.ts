import { Test, TestingModule } from '@nestjs/testing';
import { HiveuserService } from './hiveuser.service';

describe('HiveuserService', () => {
  let service: HiveuserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HiveuserService],
    }).compile();

    service = module.get<HiveuserService>(HiveuserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
