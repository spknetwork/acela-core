import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreatorRepository } from './creator.repository';
import { ContentCreator, ContentCreatorSchema } from './schemas/creator.schema';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: ContentCreator.name, schema: ContentCreatorSchema }],
      'threespeak',
    ),
    ConfigModule,
  ],
  controllers: [],
  providers: [CreatorRepository],
  exports: [CreatorRepository],
})
export class CreatorModule {}
