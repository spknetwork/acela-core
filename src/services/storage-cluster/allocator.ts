import { Db } from 'mongodb'
import WebSocket, { WebSocketServer } from 'ws'
import { Logger } from '@nestjs/common'
import { ALLOCATION_DISK_THRESHOLD, SocketMsg, SocketMsgAuth, SocketMsgPeerInfo, SocketMsgTypes, StorageCluster } from './types.js'
import { multiaddr } from 'kubo-rpc-client'

export class StorageClusterAllocator extends StorageCluster {
    peers: {
        [peerId: string]: {
            ws: WebSocket,
            totalSpaceMB?: number,
            freeSpaceMB?: number,
        }
    }
    wss: WebSocketServer

    constructor(unionDb: Db) {
        super(unionDb)
        this.peers = {}
    }

    /**
     * Fetch new hashes to pin into the cluster
     */
    async createPinWeb() {
        const posts = this.unionDb.collection('posts')
        const latestPosts = await posts.find({
            "json_metadata.app": {$regex: "3speak"}
        }, {
            sort: {
                created_at: -1
            },
            limit: 250
        }).toArray()

        for(let video of latestPosts) {
            const sourceMap = video.json_metadata.video.info.sourceMap
            if (Array.isArray(sourceMap)) {
                for(let src of sourceMap) {
                    if (src.url.startsWith('ipfs://')) {
                        await this.pins.updateOne({
                            _id: src.url.replace('ipfs://', '').split('/')[0]
                        }, {
                            $setOnInsert: {
                                status: 'new',
                                type: src.type,
                                network: video.TYPE,
                                owner: video.author,
                                permlink: video.permlink,
                                created_at: new Date().getTime(),
                                allocations: []
                            }
                        }, {
                            upsert: true
                        })
                    }
                }
            }
        }
    }

    /**
     * 
     * @param peerId Peer ID to allocate pins to
     * @returns Array of pins yet to be allocated to the peer
     */
    async getNewAllocations(peerId: string) {
        return await this.pins.find({
            $and: [{
                allocations: {
                    $not: { $elemMatch: { id: peerId } }
                }
            }, {
                $or: [{
                    median_size: { $exists: false }
                }, {
                    median_size: { $lt: this.peers[peerId].freeSpaceMB!-(this.peers[peerId].totalSpaceMB!*ALLOCATION_DISK_THRESHOLD/100) }
                }]
            }]
        }).sort({
            allocationCount: 1,
            created_at: -1
        }).limit(10).toArray()
    }

    /**
     * Init Websocket server for assignment peer
     */
    private initWss() {
        if (!process.env.IPFS_CLUSTER_WSS_PORT)
            return Logger.warn('IPFS_CLUSTER_WSS_PORT is not specified, not starting storage cluster WSS', 'storage-cluster')
        this.wss = new WebSocketServer({
            port: process.env.IPFS_CLUSTER_WSS_PORT
        })
        this.wss.on('connection', (ws) => {
            let authenticated = false
            let peerId: string
            ws.on('message', async (data) => {
                let message: SocketMsg
                try {
                    message = JSON.parse(data.toString())
                } catch {
                    return
                }
                if (!message || typeof message.type === 'undefined' || (!authenticated && message.type !== SocketMsgTypes.AUTH) || !message.data)
                    return

                switch (message.type) {
                    case SocketMsgTypes.AUTH:
                        let incomingPeerId = (message.data as SocketMsgAuth).peerId
                        if ((message.data as SocketMsgAuth).secret === process.env.IPFS_CLUSTER_SECRET) {
                            try {
                                multiaddr(incomingPeerId)
                            } catch {
                                return Logger.debug('Rejecting incoming connection due to bad peer ID')
                            }
                            authenticated = true
                            peerId = incomingPeerId
                            this.peers[peerId] = {
                                ws: ws
                            }
                            Logger.debug('Peer '+peerId+' authenticated, peer count: '+Object.keys(this.peers).length, 'storage-cluster')
                            ws.send(JSON.stringify({
                                type: SocketMsgTypes.AUTH_SUCCESS,
                                data: {}
                            }))
                        }
                        break
                    case SocketMsgTypes.PEER_INFO:
                        if (typeof (message.data as SocketMsgPeerInfo).freeSpaceMB !== 'number' || typeof (message.data as SocketMsgPeerInfo).totalSpaceMB !== 'number')
                            return
                        this.peers[peerId].freeSpaceMB = (message.data as SocketMsgPeerInfo).freeSpaceMB
                        this.peers[peerId].totalSpaceMB = (message.data as SocketMsgPeerInfo).totalSpaceMB
                        Logger.debug('Peer '+peerId+' disk available: '+Math.floor(this.peers[peerId].freeSpaceMB/1024)+' GB, total: '+Math.floor(this.peers[peerId].totalSpaceMB/1024)+' GB', 'storage-cluster')
                        if (100*this.peers[peerId].freeSpaceMB/this.peers[peerId].totalSpaceMB > ALLOCATION_DISK_THRESHOLD) {
                            // allocate new pins if above free space threshold
                            let toAllocate = await this.getNewAllocations(peerId)
                            for (let a in toAllocate) {
                                delete toAllocate[a].allocations
                                delete toAllocate[a].allocationCount
                                delete toAllocate[a].status
                            }
                            let allocated_at = new Date().getTime()
                            let cids = toAllocate.map(val => val._id)
                            let peerIds = []
                            for (let p in this.peers)
                                if (p !== peerId)
                                    peerIds.push(p)
                            await this.pins.updateMany({ _id: { $in: cids } }, {
                                $push: {
                                    allocations: {
                                        id: peerId,
                                        allocated_at
                                    }
                                },
                                $inc: {
                                    allocationCount: 1
                                }
                            })
                            Logger.debug('Allocated '+toAllocate.length+' pins to peer '+peerId)
                            ws.send(JSON.stringify({
                                type: SocketMsgTypes.PIN_ALLOCATION,
                                data: {
                                    peerIds,
                                    allocations: toAllocate
                                }
                            }))
                        }
                        break
                    case SocketMsgTypes.PIN_COMPLETED:
                    case SocketMsgTypes.PIN_FAILED:
                        break
                    default:
                        break
                }
            })

            ws.on('close', () => this.wsClosed(peerId))
            ws.on('error', () => this.wsClosed(peerId))

            setTimeout(() => {
                if (!authenticated) {
                    ws.close()
                    setTimeout(() => {
                        if (ws.readyState !== WebSocket.CLOSED)
                            ws.terminate()
                    },3000)
                }
            }, 5000)
        })
        Logger.log('IPFS storage cluster WSS started at port '+this.wss.options.port, 'storage-cluster')
    }

    private wsClosed(peerId: string) {
        Logger.debug(peerId+' left', 'storage-cluster')
        if (peerId)
            delete this.peers[peerId]
    }

    start() {
        if (!process.env.IPFS_CLUSTER_SECRET)
            return Logger.warn('IPFS_CLUSTER_SECRET is not provided, not initializing storage cluster', 'storage-cluster')
        this.initWss()
    }
}