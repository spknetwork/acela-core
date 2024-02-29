import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from './schemas/video.schema';
import { DbVideoToPublishDto, dbVideoToPublishProjection } from './dto/videos-to-publish.dto';
import { UpdateResult } from 'mongodb';
import { UploadDto } from '../upload/dto/upload.dto';
import moment from 'moment';

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
  constructor(@InjectModel(Video.name, 'threespeak') private videoModel: Model<Video>) { }

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

  async setThumbnail(video_id: string, thumbnail: string) {
    return await this.videoModel.findOneAndUpdate({
      id: video_id
    }, {
      $set: {
        thumbnail,
      }
    })
  }

  async createNewHiveVideoPost({
    video_id,
    user,
    title,
    description,
    tags,
    community,
    language,
    videoUploadLink,
    beneficiaries,
    permlink,
  }: {
    video_id: string;
    user: { 
      sub: string; 
      username: string;
      id?: string;
    };
    title: string;
    description: string;
    tags: string[];
    community: string;
    language: string;
    videoUploadLink: string;
    beneficiaries: string;
    permlink: string;
  }): Promise<Video> {
    return await this.videoModel.create({
      video_id,
      owner: user.username,
      title: title,
      description,
      beneficiaries: beneficiaries,
      permlink: permlink,
      originalFilename: 'originalFilename',
      filename: 'filename',
      size: 0,
      tags: tags || [],
      community,
      language: language || 'en',
      video_details: {
        duration: 0,
      },
      posting_options: {
        publish_type: "immediate",
        publish_date: null
      },
      created_by: user.id || user.sub,
      expires: moment().add('1', 'day').toDate(),
      upload_links: {
        video: videoUploadLink
      },
      network: "hive",
      __flags: [],
      __v: '0.1'
    });
  }
}
