import { Db } from 'mongodb'
import WebSocket, { WebSocketServer } from 'ws'
import { Logger } from '@nestjs/common'
import { ALLOCATION_DISK_THRESHOLD, SocketMsg, SocketMsgAuth, SocketMsgPeerInfo, SocketMsgPinAdd, SocketMsgPinCompl, SocketMsgPinFail, SocketMsgTypes, StorageCluster } from './types.js'
import { multiaddr } from 'kubo-rpc-client'

export class StorageClusterAllocator extends StorageCluster {
    private peers: {
        [peerId: string]: {
            ws: WebSocket,
            totalSpaceMB?: number,
            freeSpaceMB?: number,
        }
    }
    private wss: WebSocketServer

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

    calculateMedian(values: number[]) {
        if (values.length === 0)
            return null
    
        values.sort((a, b) => a - b)
    
        const half = Math.floor(values.length / 2)
    
        if (values.length % 2)
          return values[half]
    
        return (values[half - 1] + values[half]) / 2.0
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
                let currentTs = new Date().getTime()

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
                            let cids = toAllocate.map(val => val._id)
                            let peerIds = []
                            for (let p in this.peers)
                                if (p !== peerId)
                                    peerIds.push(p)
                            await this.pins.updateMany({ _id: { $in: cids } }, {
                                $push: {
                                    allocations: {
                                        id: peerId,
                                        allocated_at: currentTs
                                    }
                                },
                                $inc: {
                                    allocationCount: 1
                                }
                            })
                            Logger.debug('Allocated '+toAllocate.length+' pins to peer '+peerId, 'storage-cluster')
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
                        let completedPin = message.data as SocketMsgPinCompl
                        let pinned = await this.pins.findOne({_id: completedPin.cid})
                        let preAllocated = false
                        for (let a in pinned.allocations)
                            if (pinned.allocations[a].id === peerId) {
                                preAllocated = true
                                pinned.allocations[a].pinned_at = currentTs
                                pinned.allocations[a].reported_size = completedPin.size
                                break
                            }
                        if (!preAllocated)
                            pinned.allocations.push({
                                id: peerId,
                                allocated_at: currentTs,
                                pinned_at: currentTs,
                                reported_size: completedPin.size
                            })
                        const reported_sizes = pinned.allocations
                            .map(a => a.reported_size)
                            .filter(size => size !== null && typeof size !== 'undefined')
                        await this.pins.updateOne({_id: completedPin.cid}, {
                            $set: {
                                allocations: pinned.allocations,
                                allocationCount: pinned.allocations.length,
                                median_size: this.calculateMedian(reported_sizes)
                            }
                        })
                        break
                    case SocketMsgTypes.PIN_FAILED:
                        // cluster peer rejects allocation for any reason (i.e. errored pin or low disk space)
                        let failedPin = message.data as SocketMsgPinFail
                        let affected = await this.pins.findOne({_id: failedPin.cid})
                        for (let a in affected.allocations)
                            if (affected.allocations[a].id === peerId) {
                                if (typeof affected.allocations[a].pinned_at !== 'undefined') {
                                    Logger.verbose('Ignoring PIN_FAILED from peer '+peerId+' for '+failedPin.cid+' as it is already pinned successfully according to db', 'storage-cluster')
                                    return
                                }
                                affected.allocations.splice(parseInt(a), 1)
                                break
                            }
                        await this.pins.updateOne({_id: failedPin.cid}, {
                            $set: {
                                allocations: affected.allocations,
                                allocationCount: affected.allocations.length
                            }
                        })
                        break
                    case SocketMsgTypes.PIN_NEW:
                        // new pin from a peer
                        let newPin = message.data as SocketMsgPinAdd
                        let alreadyExists = await this.pins.findOne({_id: newPin.cid})
                        let newAlloc = {
                            id: peerId,
                            allocated_at: currentTs,
                            pinned_at: currentTs,
                            reported_size: newPin.size
                        }
                        if (!alreadyExists)
                            await this.pins.insertOne({
                                _id: newPin.cid,
                                status: 'pinned',
                                created_at: currentTs,
                                allocations: [newAlloc],
                                allocationCount: 1,
                                median_size: newPin.size
                            })
                        else {
                            let isAllocated = false
                            for (let a in alreadyExists.allocations)
                                if (alreadyExists.allocations[a].id === peerId) {
                                    isAllocated = true
                                    break
                                }
                            if (!isAllocated) {
                                alreadyExists.allocations.push(newAlloc)
                                alreadyExists.median_size = this.calculateMedian(alreadyExists.allocations
                                    .map(a => a.reported_size)
                                    .filter(size => size !== null && typeof size !== 'undefined'))
                                await this.pins.updateOne({_id: newPin.cid}, {
                                    $set: {
                                        allocations: alreadyExists.allocations,
                                        allocationCount: alreadyExists.allocations.length,
                                        median_size: alreadyExists.median_size
                                    }
                                })
                            } else
                                Logger.verbose('Ignoring new pin '+newPin.cid+' from peer '+peerId+' as it was already allocated previously', 'storage-cluster')
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