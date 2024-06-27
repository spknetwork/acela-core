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

export const HiveAccountSchema = SchemaFactory.createForClass(HiveAccount);
