import { Collection } from "mongodb";
import { CID, create } from 'kubo-rpc-client'
import { AcelaCore } from "..";
import type { IPFSHTTPClient } from 'kubo-rpc-client';
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

    reported_size?: number
}

export interface Pin {
    _id: string
    status: "new" | "queued" | "unpinned" | "active" | "deleted"
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

    async start() {
        this.pins = this.self.db.collection('pins')
        this.ipfs = create()
    }
}