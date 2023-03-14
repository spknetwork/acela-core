import { Test, TestingModule } from '@nestjs/testing';
import { TrustedclientsService } from './trustedclients.service';

describe('TrustedclientsService', () => {
  let service: TrustedclientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustedclientsService],
    }).compile();

    service = module.get<TrustedclientsService>(TrustedclientsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
