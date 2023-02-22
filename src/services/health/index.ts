import { Collection } from "mongodb";
import { CID, create } from 'ipfs-http-client'
import { AcelaCore } from "..";
import type { IPFSHTTPClient } from "ipfs-http-client/dist/src/types";
import Axios from "axios";
import { ndjsonParse } from "./ipfs-cluster-utils";

export class IpfsVerify {

    
}

interface PinAllocate {
    id: string
    key: string //Unique identifier for allocation service
    type: string //"edge", "active" "backup" "cold"

    added_at: Date
    verified_at: Date
}

interface Pin {
    status: "new" | "unpinned" | "active" | "deleted"
    owner: string
    permlink: string
    type: string
    url: string
    cid: string

    first_seen: Date

    allocations: Array<PinAllocate>
}

export class HealthCheckCore {
    self: AcelaCore;
    pins: Collection<Pin>;
    ipfs: IPFSHTTPClient;

    constructor(self) {
        this.self = self;
    }

    async findTimedoutPins() {

    }

    async createPinWeb() {
        const posts = this.self.unionDb.collection('posts')
        const latestPosts = await posts.find({
            "json_metadata.app": {$regex: "3speak"}
        }, {
            sort: {
                created_at: -1
            },
            limit: 250
        }).toArray()
        
        let out = []
        for(let video of latestPosts) {
            const sourceMap = video.json_metadata.video.info.sourceMap
            if(Array.isArray(sourceMap)) {
                for(let src of sourceMap) {
                    if(src.url.startsWith('ipfs://')) {
                        const obj = {
                            ...src, //...src should be always on top for safety reasons
                            status: "new",
                            owner: video.author,
                            permlink: video.permlink,
                            cid: src.url.replace('ipfs://', '').split('/')[0],

                            

                            allocations: []
                        }
                        await this.pins.findOneAndUpdate({
                            status: "new",
                            owner: video.author,
                            permlink: video.permlink,
                        }, {
                            $set: {
                                allocations: [],
                                type: src.type,
                                cid: obj.cid,
                            }
                        }, {
                            upsert: true
                        })
                        out.push(obj)
                    }
                }
            }
        }
    }


    /**
     * Pins directly to the local IPFS node skipping ipfs-cluster.
     */
    async pinToIpfsDirect() {
        const pins = await this.pins.find({
            "allocations.id": {$ne: "ipfs"}
        }).toArray()
        // console.log(pins)
        for(let pin of pins) {
            for await (let ref of this.ipfs.refs(pin.cid, {
                recursive: true
            })) {
                // console.log(ref)
                if(ref.ref) {
                    const data = await this.ipfs.dag.get(CID.parse(ref.ref))
                    // console.log('pinned', ref.ref, 'at size of ', data.value.length)
                }
            }
            try {
                const pinned = await this.ipfs.pin.rm(pin.cid)
                // console.log(pinned)
            } catch {

            }

            await this.pins.findOneAndUpdate({
                _id: pin._id
            }, {
                $push: {
                    allocations: {
                        id: 'ipfs',
                        key: 'ipfs-1',
                        type: 'active',
                        reported_size: (await this.ipfs.object.stat(CID.parse(pin.cid))).CumulativeSize,
                        
                        added_at: new Date(),
                        verified_at: new Date()
                    }
                }
            })
        }
        
    }
    /**
     * Pins directly to a ipfs-cluster of choice.
     */
    async pinToIpfsCluster() {

    } 

    async verifyIpfsDirect() {
        const ipfsPins = await this.pins.find({
            "allocations.id": "ipfs"
        }).toArray()
        for(let pin of ipfsPins) {
            // console.log(pin)
            try {
                for await(let pinResult of await this.ipfs.pin.ls({
                    paths: [pin.cid],
                    type: 'recursive'
                })) {
                    console.log(pinResult)
                }
            } catch {
                //Not pinned, fail
            }
            // const statResult = await this.ipfs.object.stat(CID.parse(pin.cid))
            // console.log(statResult)

        }
    }

    async verifyIpfsCluster() {
        const response = await Axios.get(`${process.env.IPFS_CLUSTER_URL}/pins`, {
            responseType: 'stream'
        })
        for await(let json of ndjsonParse(response.data)) {
            console.log(json)
        }
    }


    async start() {
        this.pins = this.self.db.collection('pins')

        this.ipfs = create()

        // await this.pins.updateMany({

        // }, {
        //     $set: {
        //         allocations: []
        //     }
        // })

        // await this.createPinWeb()
        // await this.pinToIpfsDirect()
        // await this.verifyIpfsDirect()
        // await this.verifyIpfsCluster()
    }
}