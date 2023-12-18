import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { CreatorRepository } from './creator.service';
import { ContentCreator, ContentCreatorSchema } from './schemas/creator.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockCreatorService } from './creator.service.mock';
import { Model } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ContentCreator.name, schema: ContentCreatorSchema }]),
    ConfigModule, // Needed if you're using ConfigService
  ],
  controllers: [],
  providers: [
    {
      provide: CreatorRepository,
      inject: [ConfigService, getModelToken(ContentCreator.name)],
      useFactory: (configService: ConfigService, creatorModel: Model<ContentCreator>) => {
        const env = configService.get<string>('ENVIRONMENT');
        if (env !== 'prod') {
          return new MockCreatorService(creatorModel);
        } else {
          return new CreatorRepository(creatorModel);
        }
      },
    },
  ],
  exports: [CreatorRepository]
})
export class CreatorModule {}