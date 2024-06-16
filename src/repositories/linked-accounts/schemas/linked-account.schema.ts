import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LinkedAccountDocument = HydratedDocument<LinkedAccount>;

@Schema()
export class LinkedAccount {
  @Prop({ required: true, default: 'unferified', enum: ['verified', 'unverified'] })
  status: string;

  @Prop({ required: true })
  account: string;

  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  challenge: string;
}

export const LinkedAccountSchema = SchemaFactory.createForClass(LinkedAccount);
