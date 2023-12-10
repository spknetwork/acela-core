import { Collection, Db } from 'mongodb'

export const ALLOCATION_DISK_THRESHOLD = 20 // minimum free space % to allocate pins

export enum SocketMsgTypes {
    AUTH,
    AUTH_SUCCESS,
    PEER_INFO,
    PIN_ALLOCATION
}

export type SocketMsg = {
    type: SocketMsgTypes
    data: SocketMsgAuth | SocketMsgPeerInfo | SocketMsgPinAlloc
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
    peerIds: string[],
    allocations: Pin[]
}

export class StorageCluster {
    unionDb: Db
    pins: Collection<Pin>
    peerId: string

    constructor(unionDb: Db, peerId: string) {
        this.unionDb = unionDb
        this.pins = this.unionDb.collection('pins')
        this.peerId = peerId
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
    status: "new" | "queued" | "unpinned" | "active" | "deleted"
    owner: string
    permlink: string
    network: string
    type: string
    created_at: number
    allocations: Array<PinAllocate>
    allocationCount: number
    median_size?: number
}