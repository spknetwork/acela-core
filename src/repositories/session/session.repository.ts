import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Session } from './schemas/session.schema';

@Injectable()
export class SessionRepository {
  constructor(@InjectModel('auth_sessions', 'threespeak') private sessionModel: Model<Session>) {}

  async insertOne({ id, type, sub }: { id: string; type?: string; sub?: string; }) {
    return await this.sessionModel.create({ id, type, sub })
  }
}
