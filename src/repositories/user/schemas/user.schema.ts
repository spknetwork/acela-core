import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LegacyHiveAccount } from '../../hive-account/schemas/hive-account.schema';

export type LegacyUserDocument = HydratedDocument<LegacyUser>;

@Schema()
export class LegacyUser {
  // same as userAccount.username
  @Prop({ type: String, required: true })
  user_id!: string;

  @Prop({ type: String, unique: true, sparse: true })
  sub?: string;

  @Prop({ type: Boolean, required: true, default: false })
  banned?: boolean;

  @Prop({ type: String, unique: true, sparse: true })
  email?: string;

  @Prop({ type: Types.ObjectId, ref: LegacyHiveAccount.name })
  last_identity?: Types.ObjectId;

  @Prop()
  self_deleted?: boolean;
}

export const LegacyUserSchema = SchemaFactory.createForClass(LegacyUser);
