import { Collection, Db } from 'mongodb'

export const ALLOCATION_DISK_THRESHOLD = 20 // minimum free space % to allocate pins

export enum SocketMsgTypes {
    AUTH,
    AUTH_SUCCESS,
    PEER_INFO,
    PIN_ALLOCATION,
    PIN_COMPLETED,
    PIN_FAILED
}

export type SocketMsg = {
    type: SocketMsgTypes
    data: SocketMsgAuth | SocketMsgPeerInfo | SocketMsgPinAlloc | SocketMsgPinCompl | SocketMsgPinFail
}

export type SocketMsgAuth = {
    secret: string
    peerId: string
}

export type SocketMsgPeerInfo = {
    totalSpaceMB: number
    freeSpaceMB: number
}

export type SocketMsgPinAlloc = {
    peerIds: string[]
    allocations: Pin[]
}

export type SocketMsgPinCompl = {
    cid: string
    size: number
}

export type SocketMsgPinFail = {
    cid: string
}

export class StorageCluster {
    unionDb: Db
    pins: Collection<Pin>

    constructor(unionDb: Db) {
        this.unionDb = unionDb
        this.pins = this.unionDb.collection('pins')
    }
}

interface PinAllocate {
    id: string
    allocated_at: number
    pinned_at?: number
    reported_size?: number
}

export interface Pin {
    _id: string
    status: "new" | "queued" | "failed" | "unpinned" | "pinned" | "deleted"
    owner: string
    permlink: string
    network: string
    type: string
    created_at: number
    allocations: Array<PinAllocate>
    allocationCount: number
    median_size?: number
}