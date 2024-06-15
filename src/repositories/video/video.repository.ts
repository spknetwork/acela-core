import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from './schemas/video.schema';
import { UpdateResult } from 'mongodb';
import moment from 'moment';

@Injectable()
export class VideoRepository {
  constructor(@InjectModel(Video.name, 'threespeak') private videoModel: Model<Video>) {}

  async getVideosToPublish(): Promise<Video[]> {
    return await this.videoModel
      .find({
        status: 'published',
        publishFailed: { $ne: true },
        lowRc: { $ne: true },
        owner: { $ne: 'guest-account' },
        $or: [{ steemPosted: { $exists: false } }, { steemPosted: false }],
        title: { $ne: null },
      })
      .sort('-created');
  }

  async findOneByVideoId(video_id: string) {
    return this.videoModel.findOne({ video_id }).lean();
  }

  async getVideoToPublish(owner: string, permlink: string): Promise<Video> {
    const results = await this.videoModel
      .find({
        owner: owner,
        permlink: permlink,
      })
      .sort('-created')
      .limit(1);
    return results[0];
  }

  async updateVideoFailureStatus(
    owner: Video['owner'],
    failureStatuses: { lowRc: Video['lowRc']; publishFailed: Video['publishFailed'] },
  ): Promise<UpdateResult> {
    return await this.videoModel.updateOne({ owner }, { $set: failureStatuses }).exec();
  }

  async setPostedToChain(owner: Video['owner'], ipfs?: Video['ipfs']): Promise<UpdateResult> {
    return await this.videoModel
      .updateOne({ owner }, { $set: { steemPosted: true, lowRc: false, needsHiveUpdate: !!ipfs } })
      .exec();
  }

  async setThumbnail(video_id: string, thumbnail: string) {
    return await this.videoModel.findOneAndUpdate(
      {
        id: video_id,
      },
      {
        $set: {
          thumbnail,
        },
      },
    );
  }

  async getUpvoteEligibleVideosInTimePeriod(
    bannedCreatorsList: string[],
    startPeriod: Date,
    endPeriod: Date,
  ) {
    return await this.videoModel.find({
      status: 'published',
      steemPosted: true,
      owner: { $nin: bannedCreatorsList },
      created: { $gte: startPeriod.toISOString(), $lte: endPeriod.toISOString() },
      upvoteEligible: { $ne: false },
    });
  }

  async createNewHiveVideoPost({
    user,
    title,
    description,
    tags,
    community,
    language,
    beneficiaries,
  }: {
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
    beneficiaries: string;
  }): Promise<Video> {
    return await this.videoModel.create({
      owner: user.username,
      title: title,
      description,
      beneficiaries: beneficiaries,
      originalFilename: '',
      filename: '',
      size: 0,
      tags: tags || [],
      community,
      language: language || 'en',
      video_details: {
        duration: 0,
      },
      posting_options: {
        publish_type: 'immediate',
        publish_date: null,
      },
      created_by: user.id || user.sub,
      expires: moment().add('1', 'day').toDate(),
      upload_links: {},
      network: 'hive',
      __flags: [],
      __v: '0.1',
    });
  }

  async updateHiveVideoPost({
    video_id,
    title,
    description,
    tags,
    community,
    language,
    videoUploadLink,
    beneficiaries,
    permlink,
    originalFilename,
    filename,
    size,
    duration,
  }: {
    video_id: string;
    title: string;
    description: string;
    tags: string[];
    community: string;
    language: string;
    videoUploadLink: string;
    beneficiaries: string;
    permlink: string;
    originalFilename: string;
    filename: string;
    size: number;
    duration: number;
  }): Promise<Video | null> {
    return await this.videoModel.findOneAndUpdate(
      {
        video_id: video_id,
        permlink: permlink,
      },
      {
        $set: {
          title: title,
          description,
          beneficiaries: beneficiaries,
          originalFilename: originalFilename,
          filename: filename,
          size: size,
          tags: tags || [],
          community,
          language: language || 'en',
          video_details: {
            duration: duration,
          },
          posting_options: {
            publish_type: 'immediate',
            publish_date: null,
          },
          expires: moment().add('1', 'day').toDate(),
          upload_links: {
            video: videoUploadLink,
          },
          network: 'hive',
          __flags: [],
          __v: '0.1',
        },
      },
    );
  }
}
