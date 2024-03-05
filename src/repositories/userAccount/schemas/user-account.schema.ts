import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { ulid } from 'ulid';

export type UserAccountDocument = mongoose.Document & UserAccount;

@Schema()
export class UserAccount {
  @Prop({ type: String, required: false })
  confirmationCode: string;
  
  @Prop({ type: Date, required: true, default: Date.now })
  createdAt: Date;
  
  @Prop({ type: String, unique: true })
  email: string;

  @Prop({ type: Boolean, required: true, default: false })
  emailVerified: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  enabled: boolean;

  @Prop({ type: String, default: null })
  hiveAccount: string;

  @Prop({ type: Boolean, default: false })
  keysRequested: boolean;

  @Prop({ type: Boolean, default: false })
  keysSent: boolean;
  
  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, default: 'FFFFFFFFFFFF' })
  passwordResetCode: string;

  @Prop({ type: Boolean, default: false })
  passwordResetRequired: boolean;

  @Prop({ type: Date, required: true, default: Date.now })
  updatedAt: Date;

  @Prop({ type: String, default: () => ulid(), required: true })
  username: string;

  @Prop({ type: ['UNCONFIRMED', 'CONFIRMED'], default: 'UNCONFIRMED', required: true })
  userStatus: string;

  @Prop({ type: String })
  did: string;
}

export const UserAccountSchema = SchemaFactory.createForClass(UserAccount);
