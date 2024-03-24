import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LinkedAccountDocument = HydratedDocument<LockNode>;

@Schema()
export class LockNode {
  @Prop({ required: true, type: String })
  node_id: string;
}

export const LockNodeSchema = SchemaFactory.createForClass(LockNode);
