import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Lock } from '../schemas/lock.schema';
import moment from 'moment';

@Injectable()
export class LockRepository {
  constructor(@InjectModel(Lock.name, 'acela-core') private readonly lockModel: Model<Lock>) {}

  async #findOneByIdAndUpdateRegisteredId(
    {
      id,
      registered_id,
      registered_ping = new Date(),
    }: {
      id: string;
      registered_id: string | null;
      registered_ping?: Date | null;
    },
    shouldCreate: boolean,
  ): Promise<Lock | null> {
    return await this.lockModel.findOneAndUpdate(
      {
        id,
      },
      {
        $set: {
          registered_id,
          registered_ping,
        },
      },
      {
        upsert: shouldCreate,
      },
    );
  }

  async findOneByIdAndUpdateRegisteredIdOrIgnore({
    id,
    registered_id,
    registered_ping,
  }: {
    id: string;
    registered_id: string;
    registered_ping?: Date;
  }) {
    return await this.#findOneByIdAndUpdateRegisteredId(
      { id, registered_id, registered_ping },
      false,
    );
  }

  async findOneByIdAndUpdateRegisteredIdOrCreate({
    id,
    registered_id,
    registered_ping,
  }: {
    id: string;
    registered_id: string;
    registered_ping?: Date;
  }) {
    const lock = await this.#findOneByIdAndUpdateRegisteredId(
      { id, registered_id, registered_ping },
      true,
    );
    if (!lock) throw new Error('Lock not created!');
    return lock;
  }

  async findOneByIdAndMakeInactiveIfExists({ id }: { id: string }) {
    return await this.#findOneByIdAndUpdateRegisteredId(
      { id, registered_id: null, registered_ping: null },
      false,
    );
  }

  async createOrThrowIfExistingLock(data: { id: string; registered_id: string }) {
    const existingDocument = await this.findOneById(data.id);
    if (existingDocument) {
      throw new Error('Document with the specified unique criteria already exists.');
    }
    return await this.lockModel.create(data);
  }

  async findOneById(id: string) {
    return await this.lockModel.findOne({ id });
  }

  async findOneByIdAndRegisteredId(query: { id: string; registered_id: string }) {
    return await this.lockModel.findOne(query);
  }

  async fetchServicesLastPingedBefore10Minutes() {
    return await this.lockModel.find({
      registered_ping: {
        $lt: moment().subtract('10', 'minute').toDate(),
      },
    });
  }
}
