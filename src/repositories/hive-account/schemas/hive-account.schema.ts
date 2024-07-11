import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

export type HiveAccountDocument = HydratedDocument<LegacyHiveAccount>;

@Schema()
export class LegacyHiveAccount extends Document {
  @Prop({ type: String, required: true })
  account: string;

  @Prop({ type: Types.ObjectId, required: true })
  user_id: Types.ObjectId;
}

export const LegacyHiveAccountSchema = SchemaFactory.createForClass(LegacyHiveAccount);
