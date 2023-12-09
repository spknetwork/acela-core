import { Collection, Db } from 'mongodb'
import type { Pin } from '../health'

export enum SocketMsgTypes {
    AUTH,
    AUTH_SUCCESS,
    PEER_INFO
}

export type SocketMsg = {
    type: SocketMsgTypes
    data: SocketMsgAuth | SocketMsgPeerInfo
}

export type SocketMsgAuth = {
    secret: string
    peerId: string
}

export type SocketMsgPeerInfo = {
    totalSpaceMB: number
    freeSpaceMB: number
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