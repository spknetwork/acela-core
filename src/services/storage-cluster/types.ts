import { Collection, Db } from 'mongodb'

export const ALLOCATION_DISK_THRESHOLD = 20 // minimum free space % to allocate pins

export enum SocketMsgTypes {
    AUTH,
    AUTH_SUCCESS,
    PEER_INFO,
    PIN_ALLOCATION,
    PIN_COMPLETED,
    PIN_FAILED,
    PIN_NEW,
    PIN_REMOVE,
    PIN_REMOVE_PEER
}

export type SocketMsg = {
    type: SocketMsgTypes
    data: SocketMsgAuth | SocketMsgPeerInfo | SocketMsgPinAlloc | SocketMsgPin
    ts: number
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

export type SocketMsgPin = {
    cid: string
    size?: number
}

export class StorageCluster {
    protected unionDb: Db
    protected pins: Collection<Pin>
    protected secret: string

    constructor(unionDb: Db, secret: string) {
        if (!secret)
            throw new Error('secret is required')
        this.unionDb = unionDb
        this.pins = this.unionDb.collection('pins')
        this.secret = secret
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
    created_at: number
    last_updated: number
    owner?: string
    permlink?: string
    network?: string
    type?: string
    allocations: Array<PinAllocate>
    allocationCount: number
    median_size?: number
    size?: number
}