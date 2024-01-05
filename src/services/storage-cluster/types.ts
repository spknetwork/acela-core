import { Collection, Db } from 'mongodb'
import { multiaddr } from 'kubo-rpc-client'
import type { Multiaddr } from 'kubo-rpc-client/dist/src/types.js'

export const ALLOCATION_DISK_THRESHOLD = 20 // minimum free space % to allocate pins

export enum SocketMsgTypes {
    AUTH,
    AUTH_SUCCESS,
    MSG_GOSSIP_ALLOC,
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
    data: SocketMsgAuth | SocketMsgAuthSuccess | SocketMsgPeerInfo | SocketMsgPinAlloc | SocketMsgPin | SocketMsgGossip
    ts: number
}

export type SocketMsgAuth = {
    secret: string
    peerId: string
    discovery: string
}

export type SocketMsgAuthSuccess = {
    discoveryPeers: string[]
    peerId: string
}

export type SocketMsgGossip = {
    peerId: string
    allocations: Pin[]
    ts: number
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

export type WSPeerHandler = (message: SocketMsg) => Promise<void>

export class StorageCluster {
    protected unionDb: Db
    protected pins: Collection<Pin>
    protected secret: string
    protected peerId: Multiaddr

    constructor(unionDb: Db, secret: string, peerId: string) {
        if (!secret)
            throw new Error('secret is required')
        this.unionDb = unionDb
        this.pins = this.unionDb.collection('pins')
        this.secret = secret
        this.peerId = multiaddr(peerId)
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