import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LinkedAccountDocument = HydratedDocument<Lock>;

@Schema()
export class Lock {
  @Prop({ required: true, type: String })
  id: string;

  @Prop({ required: true, type: Date })
  registered_ping: Date;

  @Prop()
  registered_id?: string;
}

export const LockSchema = SchemaFactory.createForClass(Lock);
