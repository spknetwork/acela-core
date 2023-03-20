import { Test, TestingModule } from '@nestjs/testing';
import { HiveauthuserService } from './hiveauthuser.service';

describe('HiveauthuserService', () => {
  let service: HiveauthuserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HiveauthuserService],
    }).compile();

    service = module.get<HiveauthuserService>(HiveauthuserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
