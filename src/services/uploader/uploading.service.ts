import { Injectable } from '@nestjs/common';
import { VideoRepository } from '../../repositories/video/video.repository';
import { UploadRepository } from '../../repositories/upload/upload.repository';
import { PublishingService } from '../../services/publishing/publishing.service';
import moment from 'moment';
import { UpdateUploadDto } from './dto/update-upload.dto';
import { IpfsService } from '../ipfs/ipfs.service';
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';
import { Upload } from './types';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UploadingService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly videoRepository: VideoRepository,
    private readonly ipfsService: IpfsService,
    private readonly publishingService: PublishingService,
  ) {}

  async uploadThumbnail(
    file: any,
    video_id: string,
    user: { sub: string; username: string; id?: string },
  ) {
    const id = uuid();

    const { cid }: { cid: string } = await this.ipfsService.addData(
      process.env.IPFS_CLUSTER_URL,
      file.buffer,
      {
        metadata: {
          key: `${video_id}/thumbnail`,
          app: '3speak-beta',
          message: 'acela beta please ignore',
        },
        // replicationFactorMin: 1,
        // replicationFactorMax: 2,
      },
    );

    await this.uploadRepository.createThumbnailUpload(id, cid, video_id, user);

    await this.videoRepository.setThumbnail(video_id, id);

    return cid;
  }

  async createUpload(user: { sub: string; username: string; id?: string }) {
    const video_id = uuid();
    const upload_id = uuid();
    const permlink = crypto.randomBytes(8).toString('base64url').toLowerCase().replace('_', '');

    await this.videoRepository.createNewHiveVideoPost({
      video_id,
      user,
      title: ' ',
      description: ' ',
      tags: [],
      community: '',
      language: 'en',
      videoUploadLink: video_id,
      beneficiaries: '[]',
      permlink: permlink,
    });

    await this.uploadRepository.insertOne({
      upload_id,
      video_id,
      expires: moment().add('1', 'day').toDate(),
      created_by: user.id || user.sub,
      ipfs_status: 'pending',
      type: 'video',
      immediatePublish: false,
    });

    return {
      video_id,
      upload_id,
      permlink,
    };
  }

  async startEncode(upload_id: string, video_id: string, permlink: string, owner: string) {
    const uploadJob = await this.uploadRepository.findOne({
      upload_id: upload_id,
      video_id: video_id,
      type: 'video',
    });
    if (uploadJob) {
      if (uploadJob.immediatePublish) {
        const publishData = await this.videoRepository.getVideoToPublish(owner, permlink);
        await this.publishingService.publish(publishData);
      }
      await this.uploadRepository.setIpfsStatusToReady(video_id);
    }
    // return something that - yes video moved to 'ready'
  }

  async getVideoTitleLength(permlink: string, owner: string): Promise<number> {
    const publishData = await this.videoRepository.getVideoToPublish(owner, permlink);
    return publishData.title.length;
  }

  async postUpdate(details: UpdateUploadDto) {
    await this.videoRepository.updateHiveVideoPost({
      video_id: details.video_id,
      description: details.body,
      beneficiaries: details.beneficiaries,
      community: details.community,
      duration: details.duration,
      filename: details.filename,
      language: details.language,
      originalFilename: details.originalFilename,
      permlink: details.permlink,
      size: details.size,
      tags: details.tags,
      title: details.title,
      videoUploadLink: details.video_id,
    });
  }

  async handleTusdCallback(uploadMetaData: Upload) {
    if (uploadMetaData.authorization === 'TESTING') {
      throw new Error('TestAuthorizationError');
    }
    if (uploadMetaData.Size >= 5000000000) {
      throw new Error('File too big to be uploaded');
    }
    if (!uploadMetaData.Storage) {
      throw new Error('Storage is undefined');
    }
    const info: ffmpeg.FfprobeData = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(uploadMetaData.Storage!.Path, (err: any, data: ffmpeg.FfprobeData) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
    const videoStreamInfo = info['streams'][0];
    const formatInfo = info['format'];
    let immediatePublish = false;
    if (videoStreamInfo['codec_name'] && videoStreamInfo['codec_name'].toLowerCase() == 'h264') {
      immediatePublish = true;
    }
    if (
      formatInfo['format_long_name'] &&
      formatInfo['format_long_name'].toLowerCase().includes('mov')
    ) {
      immediatePublish = true;
    }
    await this.uploadRepository.setStorageDetails(
      uploadMetaData.MetaData.upload_id,
      uploadMetaData.MetaData.video_id,
      uploadMetaData.Storage.Path,
      uploadMetaData.ID,
      immediatePublish,
    );
  }
}
