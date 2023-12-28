import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from './schemas/video.schema';
import { DbVideoToPublishDto, dbVideoToPublishProjection } from './dto/videos-to-publish.dto';
import { UpdateResult } from 'mongodb';

type TrendingChainResponse = Array<({ 
  permlink: string;
  title: string;
  duration: number;
  created: Date;
  language: string;
  views: number;
  trending_position: number;
  author: string; images: {
    thumbnail: string;
    poster: string;
    post: string;
  }
  tags: string[];
})>;

@Injectable()
export class VideoRepository {
  constructor(@InjectModel(Video.name) private videoModel: Model<Video>) {}

  async getVideosToPublish(): Promise<DbVideoToPublishDto[]> {
    return await this.videoModel.find({
      status: 'published',
      publishFailed: { $ne: true },
      lowRc: { $ne: true },
      owner: { $ne: 'guest-account' },
      $or: [
        { steemPosted: { $exists: false } }, { steemPosted: false }
      ],
      title: { $ne: null }
    }, dbVideoToPublishProjection).sort('-created');
  }

  async updateVideoFailureStatus(owner: Video['owner'], failureStatuses: { lowRc: Video['lowRc']; publishFailed: Video['publishFailed']; }): Promise<UpdateResult> {
    return await this.videoModel.updateOne({ owner }, { $set: failureStatuses }).exec()
  }

  async setPostedToChain(owner: Video['owner'], ipfs?: Video['ipfs']): Promise<UpdateResult> {
    return await this.videoModel.updateOne({ owner }, { $set: { steemPosted: true, lowRc: false, needsHiveUpdate: !!ipfs } }).exec()
  }
}
