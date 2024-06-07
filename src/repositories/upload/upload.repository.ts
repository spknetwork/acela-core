import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, QueryOptions, Types, UpdateQuery } from 'mongoose';
import { Upload } from './schemas/upload.schema';

@Injectable()
export class UploadRepository {
  constructor(@InjectModel('uploads', 'acela-core') private uploadModel: Model<Upload>) {}

  async insertOne(data: Upload): Promise<Upload> {
    return await this.uploadModel.create<Upload>(data);
  }

  async findOneAndUpdate(
    filter: FilterQuery<Upload>,
    update: UpdateQuery<Upload>,
    options?: QueryOptions<Upload>,
  ): Promise<Upload | null> {
    return await this.uploadModel.findOneAndUpdate<Upload>(filter, update, options).lean().exec();
  }

  async findOne(filter: FilterQuery<Upload>) {
    return this.uploadModel.findOne(filter).exec();
  }

  async findAll(): Promise<UploadDto[]> {
    return this.uploadModel.find().exec();
  }

  async upsertThumbnailUpload(id: string, cid: string, video_id: string): Promise<Upload | null> {
    return await this.uploadModel.findOneAndUpdate(
      {
        id: id,
      },
      {
        $set: {
          video_id,
          expires: null,
          file_name: null,
          file_path: null,
          ipfs_status: 'done',
          cid: cid,
          type: 'thumbnail',
        },
      },
      {
        upsert: true,
      },
    );
  }

  async createThumbnailUpload(
    id: string,
    cid: string,
    video_id: string,
    user: {
      sub: string;
      username: string;
      id?: string;
    },
  ): Promise<Upload> {
    return await this.uploadModel.create({
      id,
      video_id,
      expires: null,
      file_name: null,
      file_path: null,
      ipfs_status: 'done',
      cid: cid,
      type: 'thumbnail',
      created_by: user.id || user.sub,
    });
  }

  async setIpfsStatusToReady(video_id: string) {
    return await this.uploadModel.findOneAndUpdate(
      {
        video_id: video_id,
      },
      {
        $set: {
          ipfs_status: 'ready',
        },
      },
    );
  }

  async setStorageDetails(
    upload_id: string,
    video_id: string,
    path: string,
    filename: string,
    immediatePublish: boolean,
  ) {
    await this.uploadModel.findOneAndUpdate(
      {
        upload_id: upload_id,
        video_id: video_id,
        type: 'video',
      },
      {
        $set: {
          file_path: path,
          file_name: filename,
          immediatePublish: immediatePublish,
        },
      },
    );
  }

  async findActiveEncodes() {
    return await this.uploadModel.find({
      encode_status: 'running',
      cid: {
        $exists: true,
      },
    });
  }

  async findReadyUploads() {
    return await this.uploadModel.find({
      encode_status: 'ready',
      cid: {
        $exists: true,
      },
    });
  }

  async setJobToDone(id: Types.ObjectId, cid: string) {
    return await this.findOneAndUpdate(
      {
        _id: id,
      },
      {
        $set: {
          encode_status: 'done',
          encode_cid: cid,
        },
      },
    );
  }

  async setJobToRunning(upload_id, encode_id) {
    return await this.findOneAndUpdate(
      {
        _id: upload_id,
      },
      {
        $set: {
          encode_id,
          encode_status: 'running',
        },
      },
    );
  }

  async setIpfsDoneAndReadyForEncode(upload_id: Types.ObjectId, cid: string) {
    return await this.findOneAndUpdate(
      {
        _id: upload_id,
      },
      {
        $set: {
          cid,
          ipfs_status: 'done',
          encode_status: 'ready',
        },
      },
    );
  }

  async findIpfsReadyUploads() {
    return await this.uploadModel.find({
      ipfs_status: 'ready',
      file_path: { $exists: true },
    });
  }
}
