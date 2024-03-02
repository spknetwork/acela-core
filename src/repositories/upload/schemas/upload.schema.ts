import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuid } from 'uuid'

export type UploadDocument = HydratedDocument<Upload>;

@Schema()
export class Upload {
  @Prop({ type: String, required: true, default: () => uuid() })
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

  @Prop({ type: Boolean, required: true, default: false })
  immediatePublish: boolean;

  // Add additional properties as needed
}

export const UploadSchema = SchemaFactory.createForClass(Upload);
