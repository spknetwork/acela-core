import { Collection, Db } from 'mongodb'
import type { Pin } from '../health'
import WebSocket, { CLOSED, WebSocketServer } from 'ws'
import { Logger } from '@nestjs/common'
import { SocketMsg, SocketMsgAuth, SocketMsgTypes } from './types'

export class StorageCluster {
    unionDb: Db
    pins: Collection<Pin>
    peers: {
        [peerId: string]: WebSocket
    }
    wss: WebSocketServer
    peerId: string

    constructor(unionDb: Db, peerId: string) {
        this.unionDb = unionDb
        this.pins = this.unionDb.collection('pins')
        this.peerId = peerId
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
                if (!message || typeof message.type === 'undefined' || !message.data)
                    return

                switch (message.type) {
                    case SocketMsgTypes.AUTH:
                        if ((message.data as SocketMsgAuth).secret === process.env.IPFS_CLUSTER_SECRET) {
                            if ((message.data as SocketMsgAuth).peerID === this.peerId)
                                return // peer id cannot be itself
                            authenticated = true
                            this.peers[message.data.peerID] = ws
                            peerId = message.data.peerID
                            Logger.debug('Peer '+peerId+' authenticated successfully, peer count: '+Object.keys(this.peers).length, 'storage-cluster')
                        }
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
                        if (ws.readyState !== CLOSED)
                            ws.terminate()
                    },3000)
                }
            }, 5000)
        })
        Logger.log('IPFS storage cluster WSS started at port '+this.wss.options.port, 'storage-cluster')
    }

    wsClosed(peerId: string) {
        if (peerId)
            delete this.peers[peerId]
    }

    start() {
        if (!process.env.IPFS_CLUSTER_SECRET)
            return Logger.warn('IPFS_CLUSTER_SECRET is not provided, not initializing storage cluster', 'storage-cluster')
        this.initWss()
    }
}