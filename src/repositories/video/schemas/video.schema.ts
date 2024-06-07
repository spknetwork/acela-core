import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

export type VideoDocument = HydratedDocument<Video>;

@Schema()
export class Video {
  @Prop({ default: () => uuid() })
  video_id?: string;

  @Prop()
  filename: string;

  @Prop()
  skynet?: string;

  @Prop()
  originalFilename: string;

  @Prop()
  thumbnail: string;

  @Prop({ required: true, default: 0 })
  score: number;

  @Prop()
  title: string;

  @Prop()
  tags?: string[];

  @Prop()
  description: string;

  @Prop({ default: false, required: true })
  lowRc: boolean;

  @Prop({
    required: true,
    enum: [
      'uploaded',
      'encoding',
      'saving',
      'published',
      'deleted',
      'encoding_failed',
      'encoding_queued',
      'encoding_halted_time',
      'encoding_queued_vod',
      'scheduled',
      'encoding_ipfs',
    ],
    default: 'uploaded',
  })
  status: string;

  @Prop()
  raw_description?: string;

  @Prop()
  size?: number;

  @Prop({
    required: false,
    default: () => crypto.randomBytes(8).toString('base64url').toLowerCase().replace('_', ''),
  })
  permlink: string;

  @Prop()
  duration?: number;

  @Prop({ required: true, default: false })
  isVOD: boolean;

  @Prop({ default: () => Date.now() })
  created?: Date;

  @Prop({ default: () => Date.now() })
  updated?: Date;

  @Prop()
  published?: Date;

  @Prop()
  pipeline?: string;

  @Prop({ required: true })
  owner: string;

  @Prop({ required: true, default: false })
  isB2: boolean;

  @Prop({ required: true, default: false })
  pinned: boolean;

  @Prop()
  b2Permlink?: string;

  @Prop({ default: false })
  is3CJContent?: boolean;

  @Prop({ required: true, default: false })
  isNsfwContent: boolean;

  @Prop({ default: 'en' })
  language?: string;

  @Prop({ default: 'general' })
  category?: string;

  @Prop({ default: false })
  firstUpload: boolean;

  @Prop({ default: 'hive-181335' })
  hive: string;

  @Prop()
  showDownload?: boolean;

  @Prop({ required: true, default: '0.000' })
  encoding_price_steem: string;

  @Prop({ default: false, required: true })
  paid: boolean;

  @Prop({ default: false })
  indexed: boolean;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: false })
  recommended: boolean;

  @Prop({ default: false })
  curationComplete: boolean;

  @Prop({ default: true })
  upvoteEligible: boolean;

  @Prop()
  app?: string;

  @Prop({ type: [String], default: [] })
  badges: string[];

  @Prop({ required: true, default: false })
  hasTorrent: boolean;

  @Prop()
  receipt?: string;

  @Prop({ required: true, enum: ['publish', 'schedule'], default: 'publish' })
  publish_type: string;

  @Prop()
  publish_data?: Date;

  @Prop({ default: false })
  declineRewards: boolean;

  @Prop({ default: false })
  rewardPowerup: boolean;

  @Prop({ required: true, default: false })
  publishFailed: boolean;

  @Prop()
  steemPosted?: boolean;

  @Prop({ default: '[]' })
  beneficiaries: string;

  @Prop()
  score_boost?: number;

  @Prop()
  ipfs?: string;

  @Prop()
  needsHiveUpdate?: boolean;

  @Prop({ required: true, default: false })
  hasAudioOnlyVersion: boolean;

  @Prop({ default: false })
  reducedUpvote: boolean;

  @Prop({ default: false })
  donations: boolean;

  @Prop({ default: false })
  postToHiveBlog: boolean;

  @Prop([String])
  tags_v2?: string[];

  @Prop()
  upload_type?: string;

  @Prop()
  job_id?: string;

  @Prop()
  video_v2?: string;

  @Prop()
  podcast_transfered?: boolean;

  @Prop()
  thumbUrl: string;

  @Prop({ default: false })
  fromMobile?: boolean;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
