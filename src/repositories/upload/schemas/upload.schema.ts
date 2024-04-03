import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ulid } from 'ulid';

export type UploadDocument = HydratedDocument<Upload>;

@Schema()
export class Upload {
  @Prop({ type: String, required: true, default: () => ulid() })
  upload_id: string;

  @Prop({ type: String, required: true, default: () => ulid() })
  video_id: string;

  @Prop({ type: Date, default: Date.now })
  expires: Date;

  @Prop({ type: String, required: false })
  file_name: string;

  @Prop({ type: String, required: false })
  file_path: string;

  @Prop({ type: String, required: true, enum: ['pending', 'done', 'error'] })
  ipfs_status: 'pending' | 'done' | 'error';

  @Prop({ type: String, required: false })
  cid: string;

  @Prop({ type: String, required: true, enum: ['video', 'thumbnail', 'other'] })
  type: 'video' | 'thumbnail' | 'other';

  @Prop({ type: String, required: true })
  created_by: string;

  @Prop({ type: String })
  encode_status: 'running' | 'ready' | 'done';

  @Prop({ type: String })
  encode_id: string;
}

export const UploadSchema = SchemaFactory.createForClass(Upload);
