import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { HiveAccount, HiveAccountSchema } from '../../hive-account/schemas/hive-account.schema';
import { ulid } from 'ulid';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User extends Document {
  @Prop({ type: String, unique: true, default: () => ulid() })
  user_id: string;

  @Prop({ type: Boolean, required: true, default: false })
  banned: boolean;

  @Prop({ type: String, required: true, unique: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: HiveAccount.name }) // Assuming 'Identity' is another schema
  last_identity: Types.ObjectId;

  @Prop()
  display_name: string;

  @Prop()
  self_deleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);