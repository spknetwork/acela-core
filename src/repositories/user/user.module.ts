import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LegacyUserRepository } from './user.repository';
import { LegacyUserSchema } from './schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'users', schema: LegacyUserSchema }], 'threespeak')],
  controllers: [],
  providers: [LegacyUserRepository],
  exports: [LegacyUserRepository],
})
export class UserModule {}
