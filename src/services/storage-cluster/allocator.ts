import { Db, Filter } from 'mongodb'
import WebSocket, { WebSocketServer } from 'ws'
import { Logger } from '@nestjs/common'
import { ALLOCATION_DISK_THRESHOLD, SocketMsg, SocketMsgGossip, SocketMsgAuth, SocketMsgPeerInfo, SocketMsgPin, SocketMsgTypes, StorageCluster, WSPeerHandler, SocketMsgPinAlloc, Pin, SocketMsgTyped } from './types.js'
import { multiaddr, CID } from 'kubo-rpc-client'

/**
 * Storage allocator to be used within a storage cluster peer
 */
export class StorageClusterAllocator extends StorageCluster {
    private peers: {
        [peerId: string]: {
            ws: WebSocket,
            discovery?: string,
            totalSpaceMB?: number,
            freeSpaceMB?: number,
        }
    }
    private wss: WebSocketServer
    private wsPort: number
    private wsPeerHandler: WSPeerHandler

    constructor(unionDb: Db, secret: string, peerId: string, wsPort: number, wsPeerHandler?: WSPeerHandler) {
        if (wsPort < 1024 || wsPort > 65535)
            throw new Error('wsPort must be between 1024 and 65535')
        super(unionDb, secret, peerId)
        this.peers = {}
        this.wsPort = wsPort
        if (typeof wsPeerHandler === 'function')
            this.wsPeerHandler = wsPeerHandler
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
                        let ts = new Date().getTime()
                        await this.pins.updateOne({
                            _id: src.url.replace('ipfs://', '').split('/')[0]
                        }, {
                            $setOnInsert: {
                                status: 'new',
                                last_updated: ts,
                                metadata: {
                                    type: src.type,
                                    network: video.TYPE,
                                    owner: video.author,
                                    permlink: video.permlink
                                },
                                created_at: ts,
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
                    median_size: { $lt: (this.peers[peerId].freeSpaceMB!-(this.peers[peerId].totalSpaceMB!*ALLOCATION_DISK_THRESHOLD/100))*1048576 }
                }]
            }, {
                status: { $ne: 'deleted' }
            }]
        }).sort({
            allocationCount: 1,
            created_at: -1
        }).limit(10).toArray()
    }

    /**
     * Unpin CID from the cluster
     * @param cid CID to unpin from cluster
     */
    async removePin(cid: string, received: boolean = false) {
        let toRm = await this.pins.findOne({_id: cid})
        if (!toRm) {
            Logger.error('Unable to remove non-existent pin ',cid)
            throw new Error('Pin does not exist')
        }
        let ts = new Date().getTime()
        await this.pins.updateOne({_id: cid}, {
            $set: {
                status: 'deleted',
                allocations: [],
                allocationCount: 0,
                last_updated: ts
            }
        })
        if (!received)
            for (let p in this.peers)
                this.peers[p].ws.send(JSON.stringify({
                    type: SocketMsgTypes.PIN_REMOVE,
                    data: { cid },
                    ts
                }))
    }

    /**
     * Push new allocations of the cluster
     * @param peerId Peer ID of the new allocation
     * @param allocations Array of pins
     * @param ts Timestamp when the allocation was made
     * @param skipDupDetect Skip duplicate allocation detection for performance
     */
    private async pushAllocations(peerId: string, allocations: Pin[], ts: number, skipDupDetect: boolean = false) {
        let cids = allocations.map(val => val._id)
        let filter: Filter<Pin> = {
            _id: { $in: cids }
        }
        if (!skipDupDetect)
            filter['allocations.id'] = { $ne: peerId }
        await this.pins.updateMany(filter, {
            $set: {
                last_updated: ts
            },
            $push: {
                allocations: {
                    id: peerId,
                    allocated_at: ts
                }
            },
            $inc: {
                allocationCount: 1
            }
        })
    }

    private async handlePeerInfoAndAllocate(peerInfo: SocketMsgPeerInfo, peerId: string, msgTs: number, currentTs: number): Promise<{ allocations: SocketMsgPinAlloc, ts: number } | null> {
        this.peers[peerId].freeSpaceMB = peerInfo.freeSpaceMB
        this.peers[peerId].totalSpaceMB = peerInfo.totalSpaceMB
        Logger.debug('Peer '+peerId+' disk available: '+Math.floor(this.peers[peerId].freeSpaceMB/1024)+' GB, total: '+Math.floor(this.peers[peerId].totalSpaceMB/1024)+' GB', 'storage-cluster')
        if (100*this.peers[peerId].freeSpaceMB/this.peers[peerId].totalSpaceMB > ALLOCATION_DISK_THRESHOLD) {
            // allocate new pins if above free space threshold
            let toAllocate = await this.getNewAllocations(peerId)
            for (let a in toAllocate) {
                delete toAllocate[a].allocations
                delete toAllocate[a].allocationCount
                delete toAllocate[a].status
            }
            let peerIds = []
            for (let p in this.peers)
                if (p !== peerId)
                    peerIds.push(p)
            await this.pushAllocations(peerId, toAllocate, currentTs, true)
            Logger.log('Allocated '+toAllocate.length+' pins to peer '+peerId, 'storage-cluster')
            let alloc = {
                peerIds,
                allocations: toAllocate
            }
            for (let p in this.peers) {
                if (p !== this.getPeerId() && p !== peerId)
                    this.peers[p].ws.send(JSON.stringify({
                        type: SocketMsgTypes.MSG_GOSSIP_ALLOC,
                        data: {
                            peerId, allocations: alloc, ts: currentTs
                        },
                        ts: currentTs
                    }))
            }
            if (peerId !== this.getPeerId() && this.peers[peerId]) {
                this.peers[peerId].ws.send(JSON.stringify({
                    type: SocketMsgTypes.PIN_ALLOCATION,
                    data: alloc,
                    ts: currentTs
                }))
            }
            return {
                allocations: alloc,
                ts: currentTs
            }
        } else
            return null
    }

    private async handlePinComplete(completedPin: SocketMsgPin, peerId: string, msgTs: number, currentTs: number) {
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
                        allocated_at: msgTs,
                        pinned_at: msgTs,
                        reported_size: completedPin.size
                    }
                },
                $inc: {
                    allocationCount: 1
                },
                $set: {
                    last_updated: msgTs,
                    median_size: this.calculateMedian(reported_sizes)
                }
            })
        } else {
            await this.pins.updateOne({_id: completedPin.cid, 'allocations.id': peerId}, {
                $set: {
                    status: 'pinned',
                    last_updated: msgTs,
                    'allocations.$': {
                        id: peerId,
                        allocated_at: pinned.allocations[preAllocated].allocated_at,
                        pinned_at: msgTs,
                        reported_size: completedPin.size
                    },
                    median_size: this.calculateMedian(reported_sizes)
                }
            })
        }
    }

    private async handlePinFailed(failedPin: SocketMsgPin, peerId: string, msgTs: number, currentTs: number) {
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
            $set: {
                last_updated: msgTs
            },
            $pull: {
                allocations: {
                    id: peerId
                }
            },
            $inc: {
                allocationCount: -1
            }
        })
    }

    private async handleNewPinFromPeer(newPin: SocketMsgPin, peerId: string, msgTs: number, currentTs: number) {
        let alreadyExists = await this.pins.findOne({_id: newPin.cid})
        let newAlloc = {
            id: peerId,
            allocated_at: msgTs,
            pinned_at: msgTs,
            reported_size: newPin.size
        }
        if (!alreadyExists)
            await this.pins.insertOne({
                _id: newPin.cid,
                status: 'pinned',
                created_at: msgTs,
                last_updated: msgTs,
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
                        last_updated: msgTs,
                        median_size: this.calculateMedian(reported_sizes)
                    }
                })
            } else
                Logger.verbose('Ignoring new pin '+newPin.cid+' from peer '+peerId+' as it was already allocated previously', 'storage-cluster')
        }
    }

    private async handlePinRmFromPeer(removedPin: SocketMsgPin, peerId: string, msgTs: number, currentTs: number) {
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
                $set: {
                    last_updated: msgTs
                },
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
    }

    /**
     * Calculates the allocator that should be used for the time slot.
     * The allocator is sorted alphabetically by peer ID and each peer take turns by the minute.
     * May not be ideal when not all peers are connected among each other for various reasons (i.e. just joined, or broken peer discovery on one peer)
     * @returns The current peer ID of the allocator within the current slot
     */
    private getCurrentAllocator() {
        let currentMinute = new Date().getMinutes()
        let peers = Object.keys(this.peers)
        peers.push(this.getPeerId())
        let sortedPeers = peers.sort()
        return sortedPeers[currentMinute%sortedPeers.length]
    }

    /**
     * Request new pin allocations from the cluster
     * @param peerInfo SocketMsgPeerInfo containing disk space information
     * @returns If allocated locally, returns the allocation details. Else returns null.
     */
    async requestAllocations(peerInfo: SocketMsgPeerInfo): Promise<{ allocations: SocketMsgPinAlloc, ts: number } | null> {
        let currentTs = new Date().getTime()
        let currentAllocator = this.getCurrentAllocator()
        if (currentAllocator !== this.getPeerId()) {
            Logger.debug('Request allocs from '+currentAllocator, 'storage-cluster')
            this.peers[currentAllocator].ws.send(JSON.stringify({
                type: SocketMsgTypes.PEER_INFO,
                data: peerInfo,
                ts: currentTs
            }))
            return null
        } else {
            Logger.debug('Allocating pins for ourselves', 'storage-cluster')
            return await this.handlePeerInfoAndAllocate(peerInfo, this.getPeerId(), currentTs, currentTs)
        }
    }

    /**
     * Beroadcast a message to all our peers
     * @param message SocketMsg with SocketMsgPin data type
     */
    broadcast(message: SocketMsgTyped<SocketMsgPin>) {
        message.data.peerId = this.getPeerId()
        for (let p in this.peers)
            if (p !== this.getPeerId())
                this.peers[p].ws.send(JSON.stringify(message))
    }

    /**
     * Handle incoming messages as allocator
     * @param message Incoming SocketMsg
     * @param peerId Source peer ID
     * @param currentTs Current timestamp
     */
    async handleSocketMsg(message: SocketMsg, peerId: string, currentTs: number) {
        switch (message.type) {
            case SocketMsgTypes.MSG_GOSSIP_ALLOC:
                let gossipInfo = message.data as SocketMsgGossip
                if (gossipInfo.peerId === this.getPeerId())
                    return
                await this.pushAllocations(gossipInfo.peerId, gossipInfo.allocations, gossipInfo.ts, false)
                break
            case SocketMsgTypes.PEER_INFO:
                let peerInfo = message.data as SocketMsgPeerInfo
                if (typeof peerInfo.freeSpaceMB !== 'number' || typeof peerInfo.totalSpaceMB !== 'number')
                    return
                await this.handlePeerInfoAndAllocate(peerInfo, peerId, message.ts, currentTs)
                break
            case SocketMsgTypes.PIN_COMPLETED:
                // peer completed pin successfully
                await this.handlePinComplete(message.data as SocketMsgPin, peerId, message.ts, currentTs)
                break
            case SocketMsgTypes.PIN_FAILED:
                // cluster peer rejects allocation for any reason (i.e. errored pin or low disk space)
                await this.handlePinFailed(message.data as SocketMsgPin, peerId, message.ts, currentTs)
                break
            case SocketMsgTypes.PIN_NEW:
                // new pin from a peer
                await this.handleNewPinFromPeer(message.data as SocketMsgPin, peerId, message.ts, currentTs)
                break
            case SocketMsgTypes.PIN_REMOVE_PEER:
                // unpinned from a peer (not to be confused as removed from entire cluster)
                await this.handlePinRmFromPeer(message.data as SocketMsgPin, peerId, message.ts, currentTs)
                break
            default:
                break
        }
    }

    /**
     * Register an authenticated peer in the allocator
     * @param peerId Peer ID of the peer
     * @param ws WebSocket object
     * @param discovery Peer discovery WSS URL
     */
    addPeer(peerId: string, ws: WebSocket, discovery: string) {
        if (!this.hasPeerById(peerId) && peerId !== this.getPeerId())
            this.peers[peerId] = {
                ws: ws,
                discovery: discovery
            }
    }

    /**
     * Returns whether a peer ID is registered in the allocator or not
     * @param peerId Peer ID
     * @returns boolean
     */
    hasPeerById(peerId: string): boolean {
        return !!this.peers[peerId]
    }

    /**
     * Retrieve a list of discovery URLs of our peers
     * @param peerId Target peer ID that are discovering peers
     * @returns Array of strings
     */
    private getDiscoveryPeers(peerId: string): string[] {
        let result = []
        for (let i in this.peers)
            if (i !== peerId && this.peers[i].discovery && i !== this.getPeerId())
                result.push(this.peers[i].discovery)
        return result
    }

    /**
     * Init Websocket server for assignment peer
     */
    private initWss() {
        this.wss = new WebSocketServer({
            port: this.wsPort
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

                // handle authentication of peers
                if (message.type === SocketMsgTypes.AUTH) {
                    if (authenticated)
                        return
                    let incomingPeerId = (message.data as SocketMsgAuth).peerId
                    if ((message.data as SocketMsgAuth).secret === this.secret) {
                        try {
                            multiaddr(incomingPeerId)
                        } catch {
                            return Logger.debug('Rejecting incoming connection due to bad peer ID')
                        }
                        authenticated = true
                        peerId = incomingPeerId
                        this.addPeer(peerId, ws, (message.data as SocketMsgAuth).discovery)
                        Logger.debug('Peer '+peerId+' authenticated, peer count: '+Object.keys(this.peers).length, 'storage-cluster')
                        ws.send(JSON.stringify({
                            type: SocketMsgTypes.AUTH_SUCCESS,
                            data: {
                                discoveryPeers: this.getDiscoveryPeers(peerId),
                                peerId: this.getPeerId()
                            },
                            ts: currentTs
                        }))
                    }
                    return
                }

                // handle authenticated peers messages
                await this.handleSocketMsg(message, peerId, currentTs)

                // handle peer messages from allocators connected inbound from other peers
                await this.wsPeerHandler(message)
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

    /**
     * Deregister a peer from the allocator (i.e. WS disconnected)
     * @param peerId Peer ID to deregister
     */
    wsClosed(peerId: string) {
        Logger.debug('Peer '+peerId+' left', 'storage-cluster')
        if (peerId)
            delete this.peers[peerId]
    }

    /**
     * Invocation function for the storage allocator
     */
    start() {
        this.initWss()
    }
}