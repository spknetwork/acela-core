import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DelegatedAuthorityRepository } from './delegated-authority.repository';
import { DelegatedAuthority, DelegatedAuthoritySchema } from './schemas/delegated-authority.schema';
import { Model } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DelegatedAuthority.name, schema: DelegatedAuthoritySchema }], 'threespeak'),
  ],
  controllers: [],
  providers: [DelegatedAuthorityRepository],
  exports: [DelegatedAuthorityRepository]
})
export class DelegatedAuthorityModule {}