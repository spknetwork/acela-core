import { Collection, Db } from 'mongodb'
import { multiaddr } from 'kubo-rpc-client'
import type { Multiaddr, IPFSHTTPClient } from 'kubo-rpc-client/dist/src/types.js'

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
    PIN_REMOVE_PEER,
    SYNC_REQ,
    SYNC_RESP
}

export type SocketMsg = {
    type: SocketMsgTypes
    data: SocketMsgAuth | SocketMsgAuthSuccess | SocketMsgPeerInfo | SocketMsgPinAlloc | SocketMsgPin | SocketMsgGossip | SocketMsgSyncResp
    ts: number
}

export type SocketMsgTyped<T> = {
    type: SocketMsgTypes
    data: T
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
    lastPin: number
    lastUnpin: number
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
    peerId?: string
    cid: string
    size?: number
    metadata?: PinMetadata
}

export type SocketMsgSyncReq = {
    lastPin: number,
    lastUnpin: number
}

export type SocketMsgSyncResp = {
    pins: Pin[],
    unpins: Pin[]
}

export type WSPeerHandler = (message: SocketMsg) => Promise<void>

export class StorageCluster {
    protected unionDb: Db
    protected pins: Collection<Pin>
    protected secret: string
    protected ipfs: IPFSHTTPClient
    protected peerId: Multiaddr

    constructor(unionDb: Db, secret: string, ipfs: IPFSHTTPClient, peerId: string) {
        if (!secret)
            throw new Error('secret is required')
        this.unionDb = unionDb
        this.pins = this.unionDb.collection('pins')
        this.secret = secret
        this.ipfs = ipfs
        this.peerId = multiaddr(peerId)
    }

    getPeerId(): string {
        return this.peerId.toString()
    }
}

export interface PinAllocate {
    id: string
    allocated_at: number
    pinned_at?: number | undefined
    reported_size?: number | undefined
}

export interface Pin {
    _id: string
    status: "new" | "queued" | "failed" | "unpinned" | "pinned" | "deleted"
    created_at: number
    last_updated: number
    metadata: {
        owner?: string
        permlink?: string
        network?: string
        type?: string
    }
    allocations: Array<PinAllocate>
    allocationCount: number
    median_size: number
    size?: number
}

export interface PinMetadata {
    type: string
    network: string
    owner: string
    permlink: string
}

export interface LatestPin {
    _id: string
    created_at: number
    last_updated: number
}