import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DelegatedAuthorityDocument = HydratedDocument<DelegatedAuthority>;

@Schema()
export class DelegatedAuthority {
  @Prop({ required: true })
  to: string;

  @Prop({ required: true })
  from: string;
}

export const DelegatedAuthoritySchema = SchemaFactory.createForClass(DelegatedAuthority);
