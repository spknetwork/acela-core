import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Lock } from '../schemas/lock.schema';
import moment from 'moment';

@Injectable()
export class LockRepository {
  constructor(
    @InjectModel(Lock.name, 'acela-core') private readonly lockModel: Model<Lock>,
  ) { }

  async #findOneByIdAndUpdateRegisteredId({ id, registered_id }, shouldCreate: boolean) {
    return await this.lockModel.findOneAndUpdate({
      id
    }, {
      $set: {
        registered_id,
        registered_ping: new Date()
      }
    }, {
      upsert: shouldCreate
    })
  }

  async findOneByIdAndUpdateRegisteredIdOrIgnore({ id, registered_id }: { id: string, registered_id: string }) {
    return await this.#findOneByIdAndUpdateRegisteredId({ id, registered_id }, false);
  }

  async findOneByIdAndUpdateRegisteredIdOrCreate({ id, registered_id }: { id: string, registered_id: string }) {
    return await this.#findOneByIdAndUpdateRegisteredId({ id, registered_id }, true);
  }

  async findOneById(id: string) {
    return await this.lockModel.findOne({ id });
  }

  async findOneByIdAndRegisteredId(query: { id: string; registered_id: string; }) {
    return await this.lockModel.findOne(query);
  }

  async fetchServicesLastPingedBefore10Minutes() {
    return await this.lockModel.find({
      registered_ping: {
          $lt: moment().subtract('10', 'minute').toDate()
      }
    });
  }
}
