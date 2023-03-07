import { Test, TestingModule } from '@nestjs/testing'
import { HiveuserService } from './hiveuser.service'
import { JwtService } from '@nestjs/jwt'
describe('HiveuserService', () => {
  let service: HiveuserService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HiveuserService, JwtService],
    }).compile()

    service = module.get<HiveuserService>(HiveuserService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
