import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRepository } from './user.repository';
import { User, UserSchema } from './schemas/user.schema';
import { Model } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }], 'threespeak'),
  ],
  controllers: [],
  providers: [UserRepository],
  exports: [UserRepository]
})
export class UserModule {}