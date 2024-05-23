import FormData from 'form-data'
import 'dotenv/config'
import { Injectable } from '@nestjs/common'
import Axios from 'axios'
import { IpfsService } from './ipfs.service'
import { IIpfsService } from './ipfs.types'

@Injectable()
export class MockIpfsService extends IpfsService implements IIpfsService {
  #data: Object[] = []
  // readonly #axios = new Axios();
  constructor() {
    super()
  }

  addData = async (cluster, file, options: any) => {
    const body = new FormData()
    body.append('file', file)

    const params = this.encodeAddParams(options)

    try {
      const reqConfig = {
          params: params,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
      };
      this.#data.push({ ...body, ...reqConfig });
      return { cid: 'mock-cid', path: '/test' }
    } catch (err) {
      const error = /** @type {Error & {response?:Response}}  */ err
      if (error.response?.ok) {
        throw new Error(`failed to parse response body from cluster add ${error.stack}`)
      } else {
        throw error
      }
    }
  }
}