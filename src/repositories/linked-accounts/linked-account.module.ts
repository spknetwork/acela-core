import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LinkedAccountRepository } from './linked-account.repository';
import { LinkedAccount, LinkedAccountSchema } from './schemas/linked-account.schema';
import { Model } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LinkedAccount.name, schema: LinkedAccountSchema }], 'acela-core'),
  ],
  controllers: [],
  providers: [LinkedAccountRepository],
  exports: [LinkedAccountRepository]
})
export class LinkedAccountModule {}