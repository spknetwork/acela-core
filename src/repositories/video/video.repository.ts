import { FilterQuery, Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Video } from './schemas/video.schema';
import { UpdateResult } from 'mongodb';
import moment from 'moment';

@Injectable()
export class VideoRepository {
  constructor(@InjectModel(Video.name, 'acela-core') private videoModel: Model<Video>) {}

  async getVideosToPublish(): Promise<Video[]> {
    return await this.videoModel
      .find({
        publishFailed: { $ne: true },
        lowRc: { $ne: true },
        owner: { $ne: 'guest-account' },
        $or: [{ steemPosted: { $exists: false } }, { steemPosted: false }],
        title: { $ne: null },
        network: 'hive',
      })
      .sort('-created');
  }

  async getScheduledVideosToPublish() {
    const query: FilterQuery<Video> = {
      publish_date: { $lt: new Date(), $ne: null, $exists: true },
      title: { $ne: null },
      network: 'hive',
      owner: { $ne: 'guest-account' },
      needsHiveUpdate: true,
      $or: [{ steemPosted: { $exists: false } }, { steemPosted: false }],
      publishFailed: { $ne: true },
      lowRc: { $ne: true },
    };
    return await this.videoModel.find(query).sort('-created');
  }

  async getErrorVideosToPublish(): Promise<Video[]> {
    return await this.videoModel
      .find({
        $or: [{ lowRc: true }, { publishFailed: true }],
        owner: { $ne: 'guest-account' },
        $and: [
          { $or: [{ steemPosted: { $exists: false } }, { steemPosted: false }] },
          { title: { $ne: null } },
        ],
        network: 'hive',
      })
      .sort('-created');
  }

  async findOneByVideoId(video_id: string) {
    const query = { video_id } satisfies Pick<Video, 'video_id'>;
    return this.videoModel.findOne(query).lean();
  }

  async getVideoToPublish(owner: string, permlink: string): Promise<Video> {
    const query = {
      owner,
      permlink,
    } satisfies Pick<Video, 'owner' | 'permlink'>;
    const results = await this.videoModel.find(query).sort('-created').limit(1);
    return results[0];
  }

  async updateVideoFailureStatus(
    authorPerm: Pick<Video, 'owner' | 'permlink'>,
    failureStatuses: Pick<Video, 'lowRc' | 'publishFailed'>,
  ): Promise<UpdateResult> {
    return await this.videoModel.updateOne(authorPerm, { $set: { ...failureStatuses } }).exec();
  }

  async setPostedToChain({
    owner,
    permlink,
    ipfs,
  }: Pick<Video, 'ipfs' | 'owner' | 'permlink'>): Promise<UpdateResult> {
    const updateQuery: FilterQuery<Video> = {
      $set: { steemPosted: true, lowRc: false, needsHiveUpdate: !!ipfs },
    };
    return await this.videoModel.updateOne({ owner, permlink }, updateQuery).exec();
  }

  async setThumbnail(video_id: Video['video_id'], thumbnail: Video['thumbnail']) {
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
    const query: FilterQuery<Video> = {
      steemPosted: true,
      owner: { $nin: bannedCreatorsList },
      created: { $gte: startPeriod.toISOString(), $lte: endPeriod.toISOString() },
      upvoteEligible: { $ne: false },
    };
    return await this.videoModel.find(query);
  }

  async createNewHiveVideoPost({
    created_by,
    owner,
    title,
    description,
    tags,
    community,
    language,
    beneficiaries,
  }: Pick<
    Video,
    | 'created_by'
    | 'owner'
    | 'title'
    | 'description'
    | 'tags'
    | 'community'
    | 'language'
    | 'beneficiaries'
  >): Promise<Video> {
    return await this.videoModel.create({
      owner,
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
      created_by,
      expires: moment().add('1', 'day').toDate(),
      //upload_links: {},
      network: 'hive',
      __flags: [],
      __v: '0.1',
    });
  }

  async updateHiveVideoPost(
    filter: { video_id: string } | { owner: string; permlink: string },
    {
      title,
      description,
      tags,
      community,
      language = 'en',
      beneficiaries,
      originalFilename,
      filename,
      size,
      duration,
      publish_date,
    }: Partial<
      Pick<
        Video,
        | 'title'
        | 'description'
        | 'tags'
        | 'community'
        | 'language'
        | 'beneficiaries'
        | 'originalFilename'
        | 'filename'
        | 'size'
        | 'duration'
        | 'publish_date'
      >
    >,
  ): Promise<Video | null> {
    const videoUpdate: Partial<Video> = {
      title,
      description,
      beneficiaries,
      originalFilename,
      filename,
      size,
      tags: tags || [],
      community,
      language,
      publish_date,
      duration,
      network: 'hive',
      needsHiveUpdate: filename ? filename?.endsWith('.mp4') || filename?.endsWith('.m3u8') : true,
    };

    // Remove undefined values from videoUpdate
    Object.keys(videoUpdate).forEach(
      (key) => videoUpdate[key] === undefined && delete videoUpdate[key],
    );

    return await this.videoModel.findOneAndUpdate(
      filter,
      { $set: videoUpdate },
      { returnDocument: 'after' },
    );
  }
}
