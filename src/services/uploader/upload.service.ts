import { Injectable } from '@nestjs/common';
import { VideoRepository } from '../../repositories/video/video.repository';
import { UploadRepository } from '../../repositories/upload/upload.repository';
import {v4 as uuid, v5 as uuidv5} from 'uuid'
import * as IpfsClusterUtils from '../../utils/ipfsClusterUtils'
import { ulid } from 'ulid';
import moment from 'moment';
import { CreateUploadDto } from './dto/create-upload.dto';

@Injectable()
export class UploadingService {

  constructor(private readonly uploadRepository: UploadRepository, private readonly videoRepository: VideoRepository) {}

  async uploadThumbnail(file: any, video_id: string) {
    const id = uuidv5(`thumbnail`, video_id)

    console.log('uploaded thumbnail', file)
    const { cid } = await IpfsClusterUtils.addData(process.env.IPFS_CLUSTER_URL, file.buffer, {
      metadata: {
        key: `${video_id}/thumbnail`,
        app: "3speak-beta",
        message: "acela beta please ignore"
      },
      replicationFactorMin: 1,
      replicationFactorMax: 2,
    })

    await this.uploadRepository.upsertThumbnailUpload(id, cid, video_id)

    await this.videoRepository.setThumbnail(video_id, id)
    
    console.log('uploadedFile', file.path)
    console.log('uploadedFile', file)

    return cid;
  }

  async createUpload(user: { sub: string, username: string }, details: CreateUploadDto) {
    const video_id = ulid();
    const upload_id = ulid();

    await this.videoRepository.createNewHiveVideoPost({
      video_id,
      user,
      title: details.title,
      description: details.body,
      tags: details.tags || [],
      community: details.community, //'',
      language: details.language || 'en', //'en',
      videoUploadLink: video_id
    })

    // console.log(localPost)


    await this.uploadRepository.insertOne({
      video_id,
      expires: moment().add('1', 'day').toDate(),
      created_by: user.sub,
      ipfs_status: 'pending',
      type: 'video'
    })

    return {
      video_id,
      upload_id
    }
  }

  async startEncode(uploadId: string) {
    let uploadJob = await this.uploadRepository.findOne({
      id: uploadId
    })
    if(uploadJob) {
      await this.uploadRepository.setIpfsStatusToReady(uploadJob.video_id)
    }
  }

  async postUpdate(uploadId: any) {
    const uploadedInfo = await this.uploadRepository.findOne({
      id: uploadId
    })

    if(uploadedInfo.created_by === uploadId) {
      const updatedInfo = await this.uploadRepository.findOneAndUpdate({
        id: uploadId
      }, {
        $set: {
          // file_path: body.Upload.Storage.Path,
          // file_name: body.Upload.ID
        }
      })

      // console.log(uploadedInfo)
      
    } else {
      throw new Error('UnauthorizedAccessError')
    }
  }

  async handleTusdCallback(uploadMetaData: any) {
    if (uploadMetaData.authorization === 'TESTING') {
      throw new Error('TestAuthorizationError');
    }
    if (uploadMetaData.Storage) {
      await this.uploadRepository.setStorageDetails(
        uploadMetaData.MetaData.upload_id,
        uploadMetaData.Storage.Path,
        uploadMetaData.ID
      );
    }
  }
}
