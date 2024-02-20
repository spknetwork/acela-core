import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ContentCreator } from './schemas/creator.schema';

@Injectable()
export class CreatorRepository {
  constructor(@InjectModel(ContentCreator.name, 'threespeak') private creatorModel: Model<ContentCreator>) {}

  async getContentCreatorByUsername(username: string) {
    return this.creatorModel.findOne({ username }).exec()
  }

  async setUserToVisible(username: ContentCreator['username']) {
    return this.creatorModel.updateOne({ username, hidden: true }, { $set: { hidden: false } }).exec()
  }
}