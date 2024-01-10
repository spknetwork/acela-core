import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type HiveAccountDocument = HydratedDocument<HiveAccount>;

@Schema()
export class HiveAccount extends Document {
  @Prop({ type: String, required: true })
  account: string;

  @Prop({ type: Types.ObjectId, required: true })
  user_id: Types.ObjectId;
}

export interface HiveAccountCreation {
  status: 'requested' | 'created' | 'released'
  username: string
  keys_requested: boolean
  created_by: string | null
  requested_at: Date
  created_at: Date
  [x: string]: any
}

export const HiveAccountSchema = SchemaFactory.createForClass(HiveAccount);
