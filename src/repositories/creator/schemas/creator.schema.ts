import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ContentCreator {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, default: false })
  banned: boolean;

  @Prop({ required: true, default: false })
  livestreamEnabled: boolean;

  @Prop()
  banReason?: string;

  @Prop({ required: true, default: true })
  canUpload: boolean;

  @Prop({ required: true, default: false })
  canProxyUpvote: boolean;

  @Prop({ required: true, default: false })
  queuedCanProxyUpvote: boolean;

  @Prop()
  upvoteDay?: number;

  @Prop()
  queuedUpvoteDay?: number;

  @Prop({ default: false })
  postWarning: boolean;

  @Prop({ default: false })
  isCitizenJournalist: boolean;

  @Prop({ default: 0 })
  limit: number;

  @Prop({ default: 0 })
  queuedLimit: number;

  @Prop({ required: true, default: false })
  hidden: boolean;

  @Prop({ required: true, default: false })
  verified: boolean;

  @Prop({ required: true, default: false })
  canSubscribed: boolean;

  @Prop({ required: true, default: () => Date.now() })
  joined: Date;

  @Prop({ required: true, default: 0 })
  score: number;

  @Prop({ type: [String], default: [] })
  badges: string[];

  @Prop({ type: [Object], default: [] })
  authorized_apps: Record<string, any>[];

  @Prop({ required: true, default: 'default-user.png' })
  profile_image: string;

  @Prop({ default: false })
  awaitingVerification: boolean;

  @Prop({ default: null })
  verificationEvidence?: string;

  @Prop({ default: false })
  verificationRequired: boolean;

  @Prop({ default: null })
  verificationRequiredDate?: Date;

  @Prop({ default: false })
  warningPending: boolean;

  @Prop({ default: null })
  warningText?: string;

  @Prop({ required: true, default: true })
  upvoteEligible: boolean;

  @Prop({ type: [String], default: [] }) // Assuming that 'strikes' is an array of strings
  strikes: string[];

  @Prop({ required: true, default: false })
  darkMode: boolean;

  @Prop({ required: true, default: false })
  hasProStreaming: boolean;

  @Prop({ default: false })
  reducedUpvote: boolean;
}

export type ContentCreatorDocument = ContentCreator & Document;
export const ContentCreatorSchema = SchemaFactory.createForClass(ContentCreator);
