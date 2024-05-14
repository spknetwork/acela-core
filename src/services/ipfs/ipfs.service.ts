import FormData from 'form-data';
import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import Axios from 'axios';

@Injectable()
export class IpfsService {
  // readonly #axios = new Axios();

  /**
   * @param {API.PinOptions} options
   */
  encodePinOptions = (options: any) =>
    this.encodeParams({
      name: options.name,
      mode: options.mode,
      'replication-min': options.replicationFactorMin,
      'replication-max': options.replicationFactorMax,
      'shard-size': options.shardSize,
      'user-allocations': options.userAllocations?.join(','),
      'expire-at': options.expireAt?.toISOString(),
      'pin-update': options.pinUpdate,
      origins: options.origins?.join(','),
      ...this.encodeMetadata(options.metadata || {}),
    });

  /**
   *
   * @param {Record<string, string>} metadata
   */
  encodeMetadata = (metadata = {}) =>
    Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`meta-${k}`, v]));

  /**
   * @template {Object} T
   * @param {T} options
   * @returns {{[K in keyof T]: Exclude<T[K], undefined>}}
   */
  encodeParams = (options) =>
    // @ts-ignore - it can't infer this
    Object.fromEntries(Object.entries(options).filter(([, v]) => v != null));

  encodeAddParams = (options: any) =>
    this.encodeParams({
      ...this.encodePinOptions(options),
      local: options.local,
      recursive: options.recursive,
      hidden: options.hidden,
      wrap: options.wrap,
      shard: options.shard,
      // stream-channels=false means buffer entire response in cluster before returning.
      // MAY avoid weird edge-cases with prematurely closed streams
      // see: https://github.com/web3-storage/web3.storage/issues/323
      'stream-channels': options.streamChannels != null ? options.streamChannels : false,
      format: options.format,
      // IPFSAddParams
      layout: options.layout,

      chunker: options.chunker,
      'raw-leaves': options.rawLeaves != null ? options.rawLeaves : true,
      progress: options.progress,
      'cid-version': options.cidVersion != null ? options.cidVersion : 1,
      hash: options.hashFun,
      'no-copy': options.noCopy,
    });

  addData = async (cluster, file, options: any) => {
    const body = new FormData();
    body.append('file', file);

    const params = this.encodeAddParams(options);

    try {
      const reqConfig = {
        params: params,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };
      const { data: result } = await Axios.post(`${cluster}/add`, body, reqConfig);
      const data = params['stream-channels'] ? result : result[0];
      return { ...data, cid: data.cid };
    } catch (err) {
      const error = /** @type {Error & {response?:Response}}  */ err;
      if (error.response?.ok) {
        throw new Error(`failed to parse response body from cluster add ${error.stack}`);
      } else {
        throw error;
      }
    }
  };
}
