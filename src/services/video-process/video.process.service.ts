import Axios from 'axios';
import { DID } from 'dids';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import KeyResolver from 'key-did-resolver';
import { Cluster } from '@nftstorage/ipfs-cluster';
import fs from 'fs';
import fsPromises from 'fs/promises';
import * as Minio from 'minio';
import { UploadRepository } from '../../repositories/upload/upload.repository';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import 'dotenv/config';

@Injectable()
export class VideoProcessService {
  readonly #uploadRepository: UploadRepository;
  readonly #configService: ConfigService;
  readonly #logger: Logger;
  readonly #cluster: Cluster;
  #encoderKey: DID;

  constructor(uploadRepository: UploadRepository, configService: ConfigService) {
    this.#uploadRepository = uploadRepository;
    this.#configService = configService;
    this.#cluster = new Cluster(process.env.IPFS_CLUSTER_URL || 'http://65.21.201.94:9094', {
      headers: {},
    });
    this.#logger = new Logger(VideoProcessService.name);
  }

  async checkEncoding() {
    const readyUploads = await this.#uploadRepository.findActiveEncodes();
    for (const upload of readyUploads) {
      const { data } = await Axios.get<{ job: { status: string; result: { cid: string } } }>(
        `${this.#configService.get('ENCODER_API')}/api/v0/gateway/jobstatus/${upload.encode_id}`,
      );

      console.log(data);
      if (data.job.status === 'complete') {
        await this.#uploadRepository.setJobToDone(upload._id, data.job.result.cid);
      }
    }
  }

  async queueEncoding() {
    const readyUploads = await this.#uploadRepository.findReadyUploads();

    // console.log(readyUploads)

    for (const upload of readyUploads) {
      try {
        const { data } = await Axios.post(
          `${this.#configService.get('ENCODER_API')}/api/v0/gateway/pushJob`,
          {
            jws: await this.#encoderKey.createJWS({
              url: `${this.#configService.get('ENCODER_IPFS_GATEWAY')}/ipfs/${upload.cid}`,
              metadata: {
                // video_owner: video.owner,
                // video_permlink: video.permlink
              },
              storageMetadata: {
                key: `acela-core/video`,
                type: 'video',
                app: '3speak-beta',
                message: 'please ignore',
              },
            }),
          },
        );
        await this.#uploadRepository.setJobToRunning(upload._id, data.id);
        this.#logger.log(data);
      } catch (ex) {
        this.#logger.error(ex);
      }
    }
  }

  async queueIpfs() {
    const readyUploads = await this.#uploadRepository.findIpfsReadyUploads();

    // console.log(readyUploads)

    for (const upload of readyUploads) {
      const { cid }: { cid: string } = await this.#cluster.addData(
        fs.createReadStream(upload.file_path),
        {
          replicationFactorMin: 1,
          replicationFactorMax: 2,
        },
      );

      await this.#uploadRepository.setIpfsDoneAndReadyForEncode(upload._id, cid);
      await fsPromises.rm(upload.file_path);
    }
  }

  /**
   * For S3 minio bucket for TUSd
   */
  async initS3() {
    if (this.#configService.get('S3_ENABLED')) {
      const minioClient = new Minio.Client({
        endPoint: 'minio',
        port: 9000,
        useSSL: false,
        accessKey: 'AKIAIOSFODNN7EXAMPLE',
        secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      const needsCreation = await minioClient.bucketExists('mybucket');
      if (!needsCreation) {
        await minioClient.makeBucket('mybucket');
      }
    }
  }

  async onModuleInit() {
    const encoderSecret = this.#configService.get<string>('ENCODER_SECRET');
    if (!encoderSecret) {
      throw new Error('ENCODER_SECRET not set');
    }
    const key = new Ed25519Provider(Buffer.from(encoderSecret, 'base64'));
    const did = new DID({ provider: key, resolver: KeyResolver.getResolver() });
    await did.authenticate();
    this.#encoderKey = did;
    try {
      await this.initS3();
    } catch (ex) {
      console.log(ex);
    }
  }
}
