import { Db } from 'mongodb'
import WebSocket, { WebSocketServer } from 'ws'
import { Logger } from '@nestjs/common'
import { SocketMsg, SocketMsgAuth, SocketMsgPeerInfo, SocketMsgTypes, StorageCluster } from './types.js'

export class StorageClusterAllocator extends StorageCluster {
    peers: {
        [peerId: string]: {
            ws: WebSocket,
            totalSpaceMB?: number,
            freeSpaceMB?: number,
        }
    }
    wss: WebSocketServer

    constructor(unionDb: Db, peerId: string) {
        super(unionDb, peerId)
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
     * Init Websocket server for assignment peer
     */
    initWss() {
        if (!process.env.IPFS_CLUSTER_WSS_PORT)
            return Logger.warn('IPFS_CLUSTER_WSS_PORT is not specified, not starting storage cluster WSS', 'storage-cluster')
        this.wss = new WebSocketServer({
            port: process.env.IPFS_CLUSTER_WSS_PORT
        })
        this.wss.on('connection', (ws) => {
            let authenticated = false
            let peerId: string
            ws.on('message', (data) => {
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
                        if ((message.data as SocketMsgAuth).secret === process.env.IPFS_CLUSTER_SECRET) {
                            if ((message.data as SocketMsgAuth).peerId === this.peerId)
                                return // peer id cannot be itself
                            authenticated = true
                            this.peers[(message.data as SocketMsgAuth).peerId] = {
                                ws: ws
                            }
                            peerId = (message.data as SocketMsgAuth).peerId
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

    wsClosed(peerId: string) {
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