import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

export type LegacyUserDocument = mongoose.Document & LegacyUserAccount;

@Schema()
export class LegacyUserAccount {
  @Prop({ type: String, required: false })
  confirmationCode?: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt?: Date;

  @Prop({ type: String })
  email?: string;

  @Prop({ type: Boolean, required: true, default: false })
  emailVerified?: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  enabled?: boolean;

  @Prop({ type: String, default: null })
  hiveAccount: string | null;

  @Prop({ type: Boolean, default: false })
  keysRequested?: boolean;

  @Prop({ type: Boolean, default: false })
  keysSent?: boolean;

  @Prop({ type: String, required: false })
  password?: string;

  @Prop({ type: String, default: 'FFFFFFFFFFFF' })
  passwordResetCode?: string;

  @Prop({ type: Boolean, default: false })
  passwordResetRequired?: boolean;

  @Prop({ type: Date, required: true, default: () => new Date() })
  updatedAt?: Date;

  @Prop({ type: String, default: () => uuid(), required: true, unique: true })
  username: string;

  @Prop({ type: ['UNCONFIRMED', 'CONFIRMED'], default: 'UNCONFIRMED', required: true })
  userStatus?: string;

  @Prop({ type: String })
  sub: string;
}

export const LegacyUserAccountSchema = SchemaFactory.createForClass(LegacyUserAccount);
