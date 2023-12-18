import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from './schemas/video.schema';
import { TrendingChainDto, trendingChainProjection } from './dto/trending-chain.dto';
import { normaliseTags } from '../../utils/normaliseTags';
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

  async getTrendingForChain(): Promise<TrendingChainResponse> {
    const limit = 50;

    const videos = await this.videoModel.find<TrendingChainDto>({ status: 'published' }, trendingChainProjection)
      .sort({ score: -1 })
      .limit(limit)
      .lean()
      .exec();

    return videos.map((e ,i) => ({
      trending_position: i + 1,
      created: e.created,
      title: e.title,
      tags: normaliseTags(e.tags || ''),
      language: e.language || 'en',
      duration: e.duration || 0,
      views: e.views || 0,
      permlink: e.permlink,
      author: e.owner,
      images: {
        thumbnail: 'https://media.3speak.tv/' + e.permlink + '/thumbnail.png',
        poster: 'https://media.3speak.tv/' + e.permlink + '/poster.png',
        post: 'https://media.3speak.tv/' + e.permlink + '/post.png'
      }
    }))
  }

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
