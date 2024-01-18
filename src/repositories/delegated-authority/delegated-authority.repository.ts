import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DelegatedAuthority as DelegatedAuthority } from './schemas/delegated-authority.schema';

@Injectable()
export class DelegatedAuthorityRepository {
  constructor(@InjectModel(DelegatedAuthority.name, 'threespeak') private readonly delegatedAuthorityModel: Model<DelegatedAuthority>) {}

  async create(query: { to: string; from: string; }) {
    await this.delegatedAuthorityModel.create(query);
  }

  async findOne(query: { to: string; from: string; }) {
    return await this.delegatedAuthorityModel.findOne(query);
  }
}
