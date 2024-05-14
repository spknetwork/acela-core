import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import moment from 'moment';
import { HydratedDocument } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

@Schema()
export class Session {
  @Prop({ required: true })
  id: string;

  @Prop({ default: 'singleton' })
  type: string;

  @Prop()
  sub: string;

  @Prop({ default: () => new Date() })
  date: Date;

  @Prop({ default: () => moment().add(1, 'month').toDate() })
  expires: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Add TTL index
SessionSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
