import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { LockNode } from '../schemas/lock-node.schema';

@Injectable()
export class LockNodeRepository {
  constructor(
    @InjectModel(LockNode.name, 'acela-core') private readonly lockNodeModel: Model<LockNode>,
  ) {}

  async distinct(field: keyof LockNode) {
    return await this.lockNodeModel.distinct(field);
  }

  async findOneAndRenewOrCreate(node_id: string) {
    return await this.lockNodeModel.findOneAndUpdate(
      { node_id },
      {
        $set: {
          registered_at: new Date(),
        },
      },
      {
        upsert: true,
      },
    );
  }
}
