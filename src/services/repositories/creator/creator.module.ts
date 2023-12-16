import { Module } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { CreatorService } from './creator.service';
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
      provide: CreatorService,
      inject: [ConfigService, getModelToken(ContentCreator.name)],
      useFactory: (configService: ConfigService, creatorModel: Model<ContentCreator>) => {
        const env = configService.get<string>('ENVIRONMENT');
        if (env !== 'prod') {
          return new MockCreatorService(creatorModel);
        } else {
          return new CreatorService(creatorModel);
        }
      },
    },
  ],
  exports: [CreatorService]
})
export class CreatorModule {}