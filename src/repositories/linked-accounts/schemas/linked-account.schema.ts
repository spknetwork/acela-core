import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LinkedAccountDocument = HydratedDocument<LinkedAccount>;

@Schema()
export class LinkedAccount {
  @Prop({ required: true, default: 'unverified', enum: ['verified', 'unverified'] })
  status: 'verified' | 'unverified';

  @Prop({ required: true })
  account: string;

  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true, enum: ['HIVE'] })
  network: 'HIVE';
}

export const LinkedAccountSchema = SchemaFactory.createForClass(LinkedAccount);
