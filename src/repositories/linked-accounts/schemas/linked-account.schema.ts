import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LinkedAccountDocument = HydratedDocument<LinkedAccount>;

@Schema()
export class LinkedAccount {
  @Prop({ default: false })
  verified: boolean;

  @Prop({ required: true })
  account: string;

  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  challenge: string;

  @Prop({ required: true, default: 'unferified' })
  status: string;
}

export const LinkedAccountSchema = SchemaFactory.createForClass(LinkedAccount);
