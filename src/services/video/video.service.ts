import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from './schemas/video.schema';
import { CreateVideoDto } from './dto/create-video.dto';
import { TrendingChainDto, trendingChainProjection } from './dto/trending-chain.dto';
import { normaliseTags } from '../../utils/normaliseTags';

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
export class VideoService {
  constructor(@InjectModel(Video.name) private videoModel: Model<Video>) {}

  async create(createCatDto: CreateVideoDto): Promise<Video> {
    const createdCat = new this.videoModel(createCatDto);
    return createdCat.save();
  }

  async getTrendingForChain(): Promise<TrendingChainResponse> {
    const limit = 50;

     const videos: TrendingChainDto[] = await this.videoModel.find({ status: 'published' }, trendingChainProjection)
      .sort({ score: -1 })
      .limit(limit)
      .lean()
      .exec();

    return videos.map((e ,i) => ({
      trending_position: i + 1,
      created: e.created,
      title: e.title,
      tags: normaliseTags(e.tags),
      language: e.language || 'en',
      duration: e.duration,
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
}
