import { Injectable } from '@nestjs/common';
import { VideoRepository } from '../../repositories/video/video.repository';
import { UploadRepository } from '../../repositories/upload/upload.repository';
import { PublishingService } from '../../services/publishing/publishing.service';
import { v4 as uuid, v5 as uuidv5 } from 'uuid'
import { ulid } from 'ulid';
import moment from 'moment';
import { CreateUploadDto } from './dto/create-upload.dto';
import { IpfsService } from '../ipfs/ipfs.service';
import ffmpeg from 'fluent-ffmpeg'
import crypto from 'crypto'
@Injectable()
export class UploadingService {

  constructor(private readonly uploadRepository: UploadRepository, private readonly videoRepository: VideoRepository, private readonly ipfsService: IpfsService, private readonly publishingService: PublishingService) {}

  async uploadThumbnail(
      file: any, 
      video_id: string, 
      user: { sub: string, username: string, id?: string }
    ) {
    const id = uuidv5('thumbnail', video_id);

    const { cid } = await this.ipfsService.addData(process.env.IPFS_CLUSTER_URL, file.buffer, {
      metadata: {
        key: `${video_id}/thumbnail`,
        app: "3speak-beta",
        message: "acela beta please ignore"
      },
      // replicationFactorMin: 1,
      // replicationFactorMax: 2,
    })

    await this.uploadRepository.createThumbnailUpload(id, cid, video_id, user);

    await this.videoRepository.setThumbnail(video_id, id)
  
    return cid;
  }

  async createUpload(user: { sub: string, username: string, id?: string }, details: CreateUploadDto) {
    const video_id = uuid();
    const upload_id = uuid();
    const permlink = crypto.randomBytes(8).toString('base64url').toLowerCase().replace('_', '');

    await this.videoRepository.createNewHiveVideoPost({
      video_id,
      user,
      title: details.title,
      description: details.body,
      tags: details.tags || [],
      community: details.community, //'',
      language: details.language || 'en', //'en',
      videoUploadLink: video_id,
      beneficiaries: '[]',
      permlink: permlink,
    })

    // console.log(localPost)


    await this.uploadRepository.insertOne({
      video_id,
      expires: moment().add('1', 'day').toDate(),
      created_by: user.id || user.sub,
      ipfs_status: 'pending',
      type: 'video',
      immediatePublish: false,
    })

    return {
      video_id,
      upload_id,
      permlink,
    }
  }

  async startEncode(upload_id: string, video_id: string, permlink: string, owner: string) {
    let uploadJob = await this.uploadRepository.findOne({
      video_id: video_id,
      type: 'video'
    })
    if(uploadJob) {
      if (uploadJob.immediatePublish) {
        const publishData = await this.videoRepository.getVideoToPublish(owner, permlink);
        await this.publishingService.publish(publishData)
      }
      await this.uploadRepository.setIpfsStatusToReady(video_id)
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
      if (uploadMetaData.Size >= 5000000000) {
        throw new Error('File too big to be uploaded');
      }
      const info = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(uploadMetaData.Storage.Path, (err: any, data: any) => {
          if (err) {
            reject(err)
          }
          resolve(data)
        })
      })
      const videoStreamInfo = info['streams'][0];
      const formatInfo = info['format'];
      let immediatePublish = false;
      if (videoStreamInfo['codec_name'].toLowerCase()  == "h264") {
        immediatePublish = true;
      }
      if (formatInfo['format_long_name'].toLowerCase().includes('mov')) {
        immediatePublish = true;
      }
      await this.uploadRepository.setStorageDetails(
        uploadMetaData.MetaData.video_id,
        uploadMetaData.Storage.Path,
        uploadMetaData.ID,
        immediatePublish,
      );
    }
  }
}
