import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';

export type VideoDocument = HydratedDocument<Video>;

@Schema()
export class BeneficiarySchema {
  @Prop({ type: String, required: true })
  account: string;

  @Prop({ type: Number, required: true, min: 1, max: 10000 })
  weight: number;
}

@Schema()
export class Video {
  // New properties

  @Prop({ default: () => uuid() })
  video_id: string;

  @Prop()
  created_by: string;

  @Prop({ default: 'hive-181335' })
  community: string;

  // @Prop()
  // upload_links: {
  //   hive: string;
  // };

  @Prop({ type: Date })
  publish_date?: Date;

  @Prop()
  network: 'hive';

  // Legacy properties
  @Prop()
  filename: string;

  @Prop()
  originalFilename: string;

  @Prop()
  thumbnail: string;

  @Prop()
  title: string;

  @Prop()
  tags?: string[];

  @Prop()
  description: string;

  @Prop({ default: false, required: true })
  lowRc: boolean;

  // @Prop({
  //   required: true,
  //   enum: [
  //     'uploaded',
  //     'encoding',
  //     'saving',
  //     'published',
  //     'deleted',
  //     'encoding_failed',
  //     'encoding_queued',
  //     'encoding_halted_time',
  //     'encoding_queued_vod',
  //     'scheduled',
  //     'encoding_ipfs',
  //   ],
  //   default: 'uploaded',
  // })
  // status: string;

  @Prop()
  size?: number;

  @Prop({
    required: false,
    default: () => crypto.randomBytes(8).toString('base64url').toLowerCase().replace('_', ''),
  })
  permlink: string;

  @Prop()
  duration?: number;

  @Prop({ default: () => Date.now() })
  created: Date;

  @Prop({ default: () => Date.now() })
  updated: Date;

  @Prop({ required: true })
  owner: string;

  @Prop({ default: 'en' })
  language?: string;

  @Prop({ required: true, enum: ['publish', 'schedule'], default: 'publish' })
  publish_type: string;

  @Prop({ default: false })
  declineRewards: boolean;

  @Prop({ default: false })
  rewardPowerup: boolean;

  @Prop({ required: true, default: false })
  publishFailed: boolean;

  @Prop()
  steemPosted?: boolean;

  @Prop({ type: [BeneficiarySchema], required: true })
  beneficiaries: BeneficiarySchema[];

  @Prop()
  ipfs?: string;

  @Prop()
  needsHiveUpdate?: boolean;

  @Prop({ required: true, default: false })
  hasAudioOnlyVersion: boolean;

  @Prop({ default: false })
  reducedUpvote: boolean;

  @Prop({ default: false })
  fromMobile?: boolean;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
