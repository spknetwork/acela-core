import { Cluster } from '@nftstorage/ipfs-cluster'
import fs from 'fs'

import { File, Blob } from '@web-std/file'
import FormData from 'form-data'
import fetch from '@web-std/fetch'


import Axios from 'axios'
import NodeSchedule from 'node-schedule'

import {Ed25519Provider} from "key-did-provider-ed25519";
import Crypto from 'crypto'
import KeyResolver from 'key-did-resolver'
import {DID} from 'dids'
import { AcelaCore } from '..'

// const { Ed25519Provider } = Ed25519ProviderImport;

// const { DID } = DIDImport;

console.log(DID)


Object.assign(global, { fetch, File, Blob, FormData })


interface FileUpload {
  status: "created" | 'uploading' | "uploaded" | 'encoding' | "complete"
  type: "video" // | other
  title: string
  body: string
  beneficiaries: Array<any>

  encoder_job_id?: string
  created_by: string; //ID of user that conducted action
  owner: string //Hive account OR DID
  owner_type: "hive" | "did"
}

export let ipfsCluster = new Cluster(process.env.IPFS_CLUSTER_URL, {
  headers: {},
})

export class StorageEngine {
  self: AcelaCore
  did: DID

  constructor(self: AcelaCore) {
    this.self = self
  }

  async createUpload() {}

  async startIpfsUpload() {
    const fsPath = 'C:\\data\\0d5e9f83ae89c79a03e2297272dcc778'

    const { cid } = await ipfsCluster.addData(fs.createReadStream(fsPath), {
      replicationFactorMin: 1,
      replicationFactorMax: 2,
    })
    console.log(cid)
  }

  async startEncodeJob() {
    // const uploadInfo = await this.self.uploadsDb.findOne({
    //   id: 'test',
    // })
    // const { data } = await Axios.post(`${global.APP_ENCODER_ENDPOINT}/api/v0/gateway/pushJob`, {
    //   jws: await this.did.createJWS({
    //     url: `${global.APP_IPFS_GATEWAY_ENCODER}/ipfs/${uploadInfo.cid}`,
    //     metadata: {
    //       video_owner: uploadInfo.owner,
    //       video_permlink: uploadInfo.permlink,
    //     },
    //     storageMetadata: {
    //       key: `${uploadInfo.owner}/${uploadInfo.permlink}/video`,
    //       type: 'video',
    //       app: '3speak-beta',
    //     },
    //   }),
    // })
    // console.log(data)
  }

  async start() {
    // NodeSchedule.scheduleJob('* * * * *', () => {
    //   this.startEncodeJob()
    // })
    // NodeSchedule.scheduleJob('* * * * *', () => {
    //   this.startIpfsUpload()
    // })

    // console.log(await Ed25519Provider)
    let key = new Ed25519Provider(Buffer.from(process.env.ENCODER_SECRET, 'base64'))
    this.did = new DID({ provider: key, resolver: KeyResolver.getResolver() })

    console.log('Ipfs uploader interface starting')
    // this.startIpfsUpload()
  }
}
