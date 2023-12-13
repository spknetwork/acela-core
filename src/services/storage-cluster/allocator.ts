import { Db } from 'mongodb'
import WebSocket, { WebSocketServer } from 'ws'
import { Logger } from '@nestjs/common'
import { ALLOCATION_DISK_THRESHOLD, SocketMsg, SocketMsgAuth, SocketMsgPeerInfo, SocketMsgPin, SocketMsgTypes, StorageCluster } from './types.js'
import { multiaddr, CID } from 'kubo-rpc-client'

export class StorageClusterAllocator extends StorageCluster {
    private peers: {
        [peerId: string]: {
            ws: WebSocket,
            totalSpaceMB?: number,
            freeSpaceMB?: number,
        }
    }
    private wss: WebSocketServer

    constructor(unionDb: Db, secret: string) {
        super(unionDb, secret)
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
     * Median value of an array of numbers but uses the higher value instead of average if array length is even.
     * @param values Array of numbers to calculate the median value of.
     * @returns 
     */
    calculateMedian(values: number[]) {
        if (values.length === 0)
            return null
    
        values.sort((a, b) => a - b)
    
        const half = Math.floor(values.length / 2)
    
        return values[half]
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
     * Add a CID to the cluster pinned by a peer to be pinned by other peers
     * @param cid CID to be added to the cluster
     * @param pinned_in The peer ID where the CID is already pinned on
     */
    async addToCluster(cid: string | CID, pinned_in: string) {
        if (typeof cid === 'string')
            cid = CID.parse(cid)
        let toAdd = await this.pins.findOne({_id: cid.toString()})
        if (toAdd)
            throw new Error('CID already exists in cluster')
        else if (!this.peers[pinned_in])
            throw new Error('Peer where CID is pinned in isn\'t currently connected to the cluster')
        let ts = new Date().getTime()
        await this.pins.insertOne({
            _id: cid.toString(),
            status: 'new',
            created_at: ts,
            allocations: [{
                id: pinned_in,
                allocated_at: ts
                
            }],
            allocationCount: 1
        })
        // trigger db update in pinned_in peer
        let peerIds = []
        for (let p in this.peers)
            if (p !== pinned_in)
                peerIds.push(p)
        this.peers[pinned_in].ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_ALLOCATION,
            data: {
                peerIds,
                allocations: [{
                    _id: cid.toString(),
                    created_at: ts
                }]
            }
        }))
    }

    /**
     * Unpin CID from the cluster
     * @param cid CID to unpin from cluster
     */
    async removePin(cid: string) {
        let toRm = await this.pins.findOne({_id: cid})
        if (!toRm) {
            Logger.error('Unable to remove non-existent pin ',cid)
            throw new Error('Pin does not exist')
        }
        await this.pins.updateOne({_id: cid}, {
            $set: {
                status: 'unpinned'
            }
        })
        for (let a in toRm.allocations)
            if (this.peers[toRm.allocations[a].id])
                this.peers[toRm.allocations[a].id].ws.send(JSON.stringify({
                    type: SocketMsgTypes.PIN_REMOVE,
                    data: { cid }
                }))
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
                        if ((message.data as SocketMsgAuth).secret === this.secret) {
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
                        let completedPin = message.data as SocketMsgPin
                        let pinned = await this.pins.findOne({_id: completedPin.cid})
                        let preAllocated = -1
                        if (!pinned) {
                            Logger.verbose('Cannot process PIN_COMPLETED for pin that does not exist in cluster', 'storage-cluster')
                            return
                        }
                        for (let a in pinned.allocations)
                            if (pinned.allocations[a].id === peerId) {
                                preAllocated = parseInt(a)
                                if (typeof pinned.allocations[a].pinned_at !== 'undefined' && typeof pinned.allocations[a].reported_size !== 'undefined') {
                                    Logger.verbose('Ignoring PIN_COMPLETED for '+completedPin.cid+' from '+peerId+' as it was already processed', 'storage-cluster')
                                    return
                                }
                                break
                            }
                        const reported_sizes = pinned.allocations
                            .map(a => a.reported_size)
                            .filter(size => size !== null && typeof size !== 'undefined')
                        reported_sizes.push(completedPin.size)
                        if (preAllocated === -1) {
                            await this.pins.updateOne({_id: completedPin.cid}, {
                                $push: {
                                    allocations: {
                                        id: peerId,
                                        allocated_at: currentTs,
                                        pinned_at: currentTs,
                                        reported_size: completedPin.size
                                    }
                                },
                                $inc: {
                                    allocationCount: 1
                                },
                                $set: {
                                    median_size: this.calculateMedian(reported_sizes)
                                }
                            })
                        } else {
                            await this.pins.updateOne({_id: completedPin.cid, 'allocations.id': peerId}, {
                                $set: {
                                    status: 'pinned',
                                    'allocations.$': {
                                        id: peerId,
                                        allocated_at: pinned.allocations[preAllocated].allocated_at,
                                        pinned_at: currentTs,
                                        reported_size: completedPin.size
                                    },
                                    median_size: this.calculateMedian(reported_sizes)
                                }
                            })
                        }
                        break
                    case SocketMsgTypes.PIN_FAILED:
                        // cluster peer rejects allocation for any reason (i.e. errored pin or low disk space)
                        let failedPin = message.data as SocketMsgPin
                        let affected = await this.pins.findOne({_id: failedPin.cid})
                        for (let a in affected.allocations)
                            if (affected.allocations[a].id === peerId) {
                                if (typeof affected.allocations[a].pinned_at !== 'undefined') {
                                    Logger.verbose('Ignoring PIN_FAILED from peer '+peerId+' for '+failedPin.cid+' as it is already pinned successfully according to db', 'storage-cluster')
                                    return
                                }
                                break
                            }
                        await this.pins.updateOne({_id: failedPin.cid}, {
                            $pull: {
                                allocations: {
                                    id: peerId
                                }
                            },
                            $inc: {
                                allocationCount: -1
                            }
                        })
                        break
                    case SocketMsgTypes.PIN_NEW:
                        // new pin from a peer
                        let newPin = message.data as SocketMsgPin
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
                                const reported_sizes = alreadyExists.allocations
                                    .map(a => a.reported_size)
                                    .filter(size => size !== null && typeof size !== 'undefined')
                                reported_sizes.push(newAlloc.reported_size)
                                await this.pins.updateOne({_id: newPin.cid}, {
                                    $push: {
                                        allocations: newAlloc
                                    },
                                    $inc: {
                                        allocationCount: 1
                                    },
                                    $set: {
                                        median_size: this.calculateMedian(reported_sizes)
                                    }
                                })
                            } else
                                Logger.verbose('Ignoring new pin '+newPin.cid+' from peer '+peerId+' as it was already allocated previously', 'storage-cluster')
                        }
                        break
                    case SocketMsgTypes.PIN_REMOVE_PEER:
                        let removedPin = message.data as SocketMsgPin
                        let removedCid = await this.pins.findOne({_id: removedPin.cid})
                        if (!removedCid) {
                            Logger.verbose('Cannot process PIN_REMOVE_PEER for non-existent pin', 'storage-cluster')
                            return
                        }
                        let wasPinned = false
                        for (let a in removedCid.allocations)
                            if (removedCid.allocations[a].id === peerId)
                                wasPinned = true
                        if (wasPinned) {
                            if (removedCid.allocations.length === 1)
                                Logger.warn('Removing pin allocation for the only allocated peer for cid '+removedPin.cid+' for '+peerId, 'storage-cluster')
                            await this.pins.updateOne({_id: removedPin.cid}, {
                                $pull: {
                                    allocations: {
                                        id: peerId
                                    }
                                },
                                $inc: {
                                    allocationCount: -1
                                }
                            })
                        } else {
                            Logger.verbose('Ignoring PIN_REMOVE_PEER as pin was not allocated to peer for cid '+removedPin.cid, 'storage-cluster')
                            return
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
        Logger.debug('Peer '+peerId+' left', 'storage-cluster')
        if (peerId)
            delete this.peers[peerId]
    }

    start() {
        if (!this.secret) {
            Logger.warn('secret not provided, not initializing storage cluster', 'storage-cluster')
            throw new Error('secret is required')
        }
        this.initWss()
    }
}