import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { CreatorRepository } from './creator.repository';
import { ContentCreator, ContentCreatorSchema } from './schemas/creator.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockCreatorService } from './creator.repository.mock';
import { Model } from 'mongoose';
import { MockFactory } from '../../factories/mock.factory';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ContentCreator.name, schema: ContentCreatorSchema }], 'threespeak'),
    ConfigModule,
  ],
  controllers: [],
  providers: [
    {
      provide: CreatorRepository,
      inject: [ConfigService, getModelToken(ContentCreator.name, 'threespeak')],
      useFactory: (configService: ConfigService, creatorModel: Model<ContentCreator>) => 
        MockFactory<CreatorRepository, Model<ContentCreator>>(CreatorRepository, MockCreatorService, configService, creatorModel),
    },
  ],
  exports: [CreatorRepository]
})
export class CreatorModule {}