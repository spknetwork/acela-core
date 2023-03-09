import Axios from 'axios';
import { DID } from 'dids';
import NodeSchedule from 'node-schedule'
import {Ed25519Provider} from "key-did-provider-ed25519";
import Crypto from 'crypto'
import KeyResolver from 'key-did-resolver'
import { Cluster } from '@nftstorage/ipfs-cluster'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { AcelaCore } from "..";

let cluster = new Cluster(process.env.IPFS_CLUSTER_URL, {
    headers: {},
})

export class VideoService {
    self: AcelaCore;
    encoderKey: DID;
    constructor(self: AcelaCore) {
        this.self = self;

        this.checkEncoding = this.checkEncoding.bind(this)
        this.queueEncoding = this.queueEncoding.bind(this)
        this.queueIpfs = this.queueIpfs.bind(this)
    }

    async checkEncoding() {
        const readyUploads = await this.self.uploadsDb.find({
            encode_status: "running",
            cid: {
                $exists: true
            },
        }).toArray()
        for(let upload of readyUploads) {
            const { data } = await Axios.get(`${process.env.ENCODER_API}/api/v0/gateway/jobstatus/${upload.encode_id}`)
            
            console.log(data)
            if(data.job.status === "complete") {
                await this.self.uploadsDb.findOneAndUpdate({
                    _id: upload._id
                }, {
                    $set: {
                        encode_status: 'done',
                        encode_cid: data.job.result.cid
                    }
                })
            }
        }
    }

    async queueEncoding() {

        const readyUploads = await this.self.uploadsDb.find({
            encode_status: "ready",
            cid: {
                $exists: true
            },
        }).toArray()

        
        // console.log(readyUploads)

        for(let upload of readyUploads) {
            try {
                const { data } = await Axios.post(`${process.env.ENCODER_API}/api/v0/gateway/pushJob`, {
                    jws: await this.encoderKey.createJWS({
                        url: `${process.env.ENCODER_IPFS_GATEWAY}/ipfs/${upload.cid}`,
                        metadata: {
                            // video_owner: video.owner,
                            // video_permlink: video.permlink
                        },
                        storageMetadata: {
                            key: `acela-core/video`,
                            type: 'video',
                            app: "3speak-beta",
                            message: "please ignore"
                        }
                    })
                })
                await this.self.uploadsDb.findOneAndUpdate({
                    _id: upload._id
                }, {
                    $set: {
                        encode_id: data.id,
                        encode_status: 'running'
                    }
                })
                console.log(data)
            } catch (ex) {

            }
        }


        // console.log(data)
    }

    async queueIpfs() {

        const readyUploads = await this.self.uploadsDb.find({
            ipfs_status: "ready",
            file_path: {$exists: true}
        }).toArray()

        // console.log(readyUploads)

        for(let upload of readyUploads) {
            const { cid } = await cluster.addData(fs.createReadStream(upload.file_path), {
                replicationFactorMin: 1,
                replicationFactorMax: 2,
            })

            await this.self.uploadsDb.findOneAndUpdate({
                _id: upload._id,
            }, {
                $set: {
                    cid,
                    ipfs_status: "done",
                    encode_status: "ready"
                }
            })
            await fsPromises.rm(upload.file_path)
        }

    }
    
    async start() {
        let key = new Ed25519Provider(Buffer.from(process.env.ENCODER_SECRET, 'base64'))
        const did = new DID({ provider: key, resolver: KeyResolver.getResolver() })
        await did.authenticate()
        this.encoderKey = did
        this.self.lockService.registerHandle('check-encoding', () => {
            NodeSchedule.scheduleJob('* * * * *', this.checkEncoding)
        })
        this.self.lockService.registerHandle('queue-encoding', () => {
            NodeSchedule.scheduleJob('* * * * *', this.queueEncoding)
        })
        this.self.lockService.registerHandle('queue-ipfs', () => {
            NodeSchedule.scheduleJob('* * * * *', this.queueIpfs)
        })
    }
}