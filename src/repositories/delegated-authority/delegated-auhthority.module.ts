import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DelegatedAuthorityRepository } from './delegated-authority.repository';
import { DelegatedAuthority, DelegatedAuthoritySchema } from './schemas/delegated-authority.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: DelegatedAuthority.name, schema: DelegatedAuthoritySchema }],
      'acela-core',
    ),
  ],
  controllers: [],
  providers: [DelegatedAuthorityRepository],
  exports: [DelegatedAuthorityRepository],
})
export class DelegatedAuthorityModule {}
