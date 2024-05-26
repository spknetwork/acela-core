import { Injectable, Logger } from '@nestjs/common';
import { CreatorRepository } from './creator.repository';
import { ContentCreator } from './schemas/creator.schema';
import { Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { UpdateResult } from '../types';

@Injectable()
export class MockCreatorRepository extends CreatorRepository {
  readonly #logger: Logger;

  constructor(creatorModel: Model<ContentCreator>) {
    super(creatorModel);

    this.#logger = new Logger(MockCreatorRepository.name);
  }

  async setUserToVisible(username: string): Promise<UpdateResult> {
    this.#logger.log(username, 'set to invisible mock');
    return Promise.resolve({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      upsertedCount: 0,
      upsertedId: new ObjectId(1),
    });
  }
}
