import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuid } from 'uuid';

export type UploadDocument = HydratedDocument<Upload>;

@Schema()
export class Upload {
  @Prop({ type: String, default: () => uuid() })
  upload_id?: string;

  @Prop({ type: String, required: true })
  video_id: string;

  @Prop({ type: Date, default: Date.now })
  expires?: Date;

  @Prop({ type: String, required: false })
  file_name?: string;

  @Prop({ type: String, required: false })
  file_path?: string;

  @Prop({ type: Boolean, required: false, default: false })
  immediatePublish?: boolean;

  @Prop({ type: String, required: false, enum: ['pending', 'done', 'error'], default: 'pending' })
  ipfs_status?: 'pending' | 'done' | 'error';

  @Prop({ type: String, required: false })
  cid?: string;

  @Prop({ type: String, required: true, enum: ['video', 'thumbnail', 'other'] })
  type: 'video' | 'thumbnail' | 'other';

  @Prop({ type: String, required: true })
  created_by: string;

  @Prop({ type: String, default: 'ready' })
  encode_status?: 'running' | 'ready' | 'done';

  @Prop({ type: String })
  encode_id?: string;
}

export const UploadSchema = SchemaFactory.createForClass(Upload);
