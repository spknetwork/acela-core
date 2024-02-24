import { StorageClusterPeer } from '../../storage-cluster/peer.js'
import { CORE_MONGODB_URL } from '../../db.js'
import { PinMetadata } from '../../storage-cluster/types.js'
import { MongoClient, Db } from 'mongodb'
import { create } from 'kubo-rpc-client'
import type { IPFSHTTPClient, CID } from 'kubo-rpc-client'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StorageClusterService {
    private peer: StorageClusterPeer
    private client: MongoClient
    private db: Db
    private dbName: string
    private ipfs: IPFSHTTPClient

    constructor(dbName: string) {
        this.client = new MongoClient(CORE_MONGODB_URL)
        this.dbName = dbName
    }

    async onModuleInit() {
        await this.start()
    }

    async addToCluster(cid: string | CID, metadata?: PinMetadata) {
        await this.peer.addToCluster(cid, metadata)
    }

    async unpinFromPeer(cid: string | CID) {
        await this.peer.unpinFromPeer(cid)
    }

    async unpinFromCluster(cid: string | CID) {
        await this.peer.unpinFromCluster(cid)
    }

    async start() {
        await this.client.connect()
        this.db = this.client.db(this.dbName)
        this.ipfs = create({
            url: process.env.IPFS_CLUSTER_KUBO_API || 'http://localhost:5001'
        })
        this.peer = new StorageClusterPeer(this.db, process.env.IPFS_CLUSTER_SECRET, this.ipfs, process.env.IPFS_CLUSTER_PATH, process.env.IPFS_CLUSTER_PEER_ID, process.env.IPFS_CLUSTER_WS_URL, process.env.IPFS_CLUSTER_WSS_PORT, process.env.IPFS_CLUSTER_WS_DISCOVERY)
        this.peer.start()
    }
}