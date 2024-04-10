import { Db } from 'mongodb'
import WebSocket from 'ws'
import disk from 'diskusage'
import { ALLOCATION_DISK_THRESHOLD, Pin, PinMetadata, SocketMsg, SocketMsgAuthSuccess, SocketMsgPinAlloc, SocketMsgSyncResp, SocketMsgTyped, SocketMsgTypes, StorageCluster } from './types.js'
import { Logger } from '@nestjs/common'
import { multiaddr, CID } from 'kubo-rpc-client'
import type { IPFSHTTPClient } from 'kubo-rpc-client'
import { StorageClusterAllocator } from './allocator.js'

/**
 * Storage cluster peer node
 */
export class StorageClusterPeer extends StorageCluster {
    private wsUrl: string
    private ipfsPath: string
    private wsDiscovery: string
    private allocator: StorageClusterAllocator

    constructor(unionDb: Db, secret: string, ipfs: IPFSHTTPClient, ipfsPath: string, peerId: string, wsUrl: string, wsPort: number, wsDiscovery: string) {
        if (wsUrl && !wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://'))
            throw new Error('wsUrl must start with ws:// or wss://')
        if (wsDiscovery && !wsDiscovery.startsWith('ws://') && !wsDiscovery.startsWith('wss://'))
            throw new Error('wsDiscovery must start with ws:// or wss://')
        super(unionDb, secret, ipfs, peerId)
        this.wsUrl = wsUrl
        this.ipfsPath = ipfsPath
        this.wsDiscovery = wsDiscovery
        this.allocator = new StorageClusterAllocator(this.unionDb, this.secret, this.ipfs, this.getPeerId(), wsPort, this.handleSocketMsg)
    }

    async getDiskInfo() {
        return await disk.check(this.ipfsPath)
    }

    getIpfsApiUrl() {
        const ipfsEndpoint = this.ipfs.getEndpointConfig()
        return ipfsEndpoint.protocol+'//'+ipfsEndpoint.host+':'+ipfsEndpoint.port+ipfsEndpoint['api-path']
    }

    /**
     * Add a pinned CID to the cluster to be pinned by other nodes.
     * CID must not already exist in the cluster prior to calling this function.
     * @param cid CID to be added to the cluster
     */
    async addToCluster(cid: string | CID, metadata: PinMetadata) {
        if (typeof cid === 'string')
            cid = CID.parse(cid)
        let isPinned = false
        for await (let pinLs of this.ipfs.pin.ls({
            type: 'recursive',
            paths: [cid]
        })) {
            if (pinLs.cid.toString() === cid.toString()) {
                isPinned = true
                break
            }
        }
        if (!isPinned) {
            Logger.error('Attempting to add '+cid.toString()+' to cluster which isn\'t pinned', 'storage-peer')
            throw new Error('CID not pinned in node')
        }
        let isAdded = await this.pins.findOne({_id: cid.toString()})
        if (isAdded && isAdded.status !== 'deleted') {
            Logger.error(cid.toString()+' is already exists in the cluster, ignoring request', 'storage-peer')
            throw new Error('CID already exists in cluster')
        }
        let created_at = new Date().getTime()
        let info = await this.ipfs.files.stat('/ipfs/'+cid.toString())
        this.pins.updateOne({
            _id: cid.toString()
        }, {
            $set: {
                status: 'pinned',
                created_at,
                last_updated: created_at,
                allocations: [{
                    id: this.getPeerId(),
                    allocated_at: created_at,
                    pinned_at: created_at,
                    reported_size: info.cumulativeSize
                }],
                allocationCount: 1,
                size: info.cumulativeSize,
                median_size: info.cumulativeSize,
                metadata
            }
        }, {
            upsert: true
        })
        this.allocator.broadcast({
            type: SocketMsgTypes.PIN_NEW,
            data: {
                cid: cid.toString(),
                size: info.cumulativeSize,
                metadata
            },
            ts: created_at
        })
        Logger.log('Added new CID '+cid, 'storage-peer')
    }

    /**
     * Unpin a CID from the peer. Does not remove the pin from other peers in the cluster.
     * @param cid CID to be unpinned
     */
    async unpinFromPeer(cid: string | CID) {
        if (typeof cid === 'string')
            cid = CID.parse(cid)
        let unpinnedTs = new Date().getTime()
        await this.pins.updateOne({_id: cid.toString()}, {$set: {
            status: 'unpinned',
            last_updated: unpinnedTs
        }})
        await this.ipfs.pin.rm(cid)
        Logger.log('Unpinned '+cid.toString()+' from peer', 'storage-peer')
        this.allocator.broadcast({
            type: SocketMsgTypes.PIN_REMOVE_PEER,
            data: {
                cid: cid.toString(),
                size: 0
            },
            ts: unpinnedTs
        })
    }

    /**
     * Unpin CID from the cluster
     * @param cid CID to unpin from cluster
     */
    async unpinFromCluster(cid: string | CID) {
        if (typeof cid === 'string')
            cid = CID.parse(cid)
        await this.ipfs.pin.rm(cid)
        await this.allocator.removePin(cid.toString())
    }

    /**
     * Send peer info to an allocator for new pin allocations
     */
    private async sendPeerInfo() {
        let diskInfo = await this.getDiskInfo()
        let totalSpaceMB = Math.floor(diskInfo.total/1048576)
        let freeSpaceMB = Math.floor(diskInfo.available/1048576)
        Logger.log('Available disk space: '+Math.floor(freeSpaceMB/1024)+' GB ('+Math.floor(100*freeSpaceMB/totalSpaceMB)+'%), total: '+Math.floor(totalSpaceMB/1024)+' GB', 'storage-peer')
        let allocations = await this.allocator.requestAllocations({
            totalSpaceMB,
            freeSpaceMB
        })
        if (allocations) {
            // locally assigned
            await this.handlePinAlloc(allocations.allocations, allocations.ts)
        }
    }

    private async handlePinAlloc(allocs: SocketMsgPinAlloc, msgTs: number) {
        if (allocs.allocations.length === 0) {
            setTimeout(() => this.sendPeerInfo(), 30000)
            return
        }
        Logger.log('Received '+allocs.allocations.length+' pin allocations', 'storage-peer')
        for (let a of allocs.allocations) {
            let exists = await this.pins.findOne({_id: a._id, 'allocations.id': this.getPeerId()})
            if (!exists)
                await this.pins.updateOne({
                    _id: a._id
                }, {
                    $setOnInsert: {
                        created_at: a.created_at,
                        metadata: a.metadata
                    },
                    $set: {
                        status: 'queued',
                        last_updated: msgTs
                    },
                    $push: {
                        allocations: {
                            id: this.getPeerId(),
                            allocated_at: msgTs
                        }
                    },
                    $inc: {
                        allocationCount: 1
                    }
                }, { upsert: true })
        }
        await this.executeIPFSPin(allocs.allocations.map((val) => val._id), allocs.peerIds, msgTs)
        setTimeout(async () => await this.sendPeerInfo(), 1000)
    }

    private async executeIPFSPin(cids: string[], peerIds: string[], allocatedTs: number) {
        let swarmConnect = setInterval(async () => {
            for (let p in peerIds)
                try {
                    await this.ipfs.swarm.connect(multiaddr(peerIds[p]))
                } catch {}
        }, 15000)

        for (const cid of cids) {
            let diskInfo = await this.getDiskInfo()
            if ((100*diskInfo.free/diskInfo.total) <= ALLOCATION_DISK_THRESHOLD) {
                await this.pinFailed(cid)
                continue
            }
            try {
                let pinned = await this.ipfs.pin.add(cid)
                let size: number = 0;
                if (pinned.code === 0x70) {
                    size = (await this.ipfs.files.stat('/ipfs/'+cid)).cumulativeSize
                } else if (pinned.code === 0x71) {
                    let apiRes = (await (await fetch(this.getIpfsApiUrl()+'/dag/stat?arg='+cid, {
                        method: 'POST'
                    })).text()).trim().split('\n')
                    const lastApiResponse = apiRes[apiRes.length-1]
                    if (lastApiResponse !== undefined) {
                        size = JSON.parse(lastApiResponse).TotalSize as number
                    } else {
                        // Handle the case when the response is undefined
                        throw new Error('API response is undefined')
                    }
                }
                let pinnedTs = new Date().getTime()
                this.pins.updateOne({
                    _id: cid,
                    'allocations.id': this.getPeerId()
                }, {
                    $set: {
                        status: 'pinned',
                        last_updated: pinnedTs,
                        size: size,
                        median_size: size,
                        'allocations.$': {
                            id: this.getPeerId(),
                            allocated_at: allocatedTs,
                            pinned_at: pinnedTs,
                            reported_size: size
                        }
                    }
                })
                this.allocator.broadcast({
                    type: SocketMsgTypes.PIN_COMPLETED,
                    data: {
                        cid: cid,
                        size: size
                    },
                    ts: pinnedTs
                })
                Logger.log('Pinned '+cid+', size: '+size, 'storage-peer')
            } catch (e) {
                Logger.verbose(e)
                await this.pinFailed(cid)
            }
        }

        clearInterval(swarmConnect)
    }

    /**
     * Handle pin failures
     * @param cid CID that failed to pin
     */
    private async pinFailed(cid: string) {
        let failedTs = new Date().getTime()
        try {
            await this.pins.updateOne({
                _id: cid
            }, {
                $set: {
                    last_updated: failedTs,
                    status: 'failed'
                }
            })
        } catch {}
        this.allocator.broadcast({
            type: SocketMsgTypes.PIN_FAILED,
            data: {
                cid: cid
            },
            ts: failedTs
        })
    }

    private requestSync(lastPin: number, lastUnpin: number) {
        this.allocator.sendSyncReq({
            type: SocketMsgTypes.SYNC_REQ,
            data: {
                lastPin, lastUnpin
            },
            ts: new Date().getTime()
        })
    }

    private async responseSync(message: SocketMsgSyncResp) {
        message.pins = message.pins.sort((a, b) => a.created_at - b.created_at)
        message.unpins = message.unpins.sort((a, b) => a.created_at - b.created_at)

        if (message.pins.length === 0 && message.unpins.length === 0) {
            await this.sendPeerInfo()
            return
        }

        for (let p of message.pins)
            this.pins.updateOne({
                _id: p._id,
            }, {
                $set: {
                    status: 'pinned',
                    created_at: p.created_at,
                    last_updated: p.last_updated,
                    allocations: p.allocations,
                    allocationCount: p.allocationCount,
                    median_size: p.median_size,
                    metadata: p.metadata
                }
            }, {
                upsert: true
            })
        
        for (let u of message.unpins) {
            try {
                await this.ipfs.pin.rm(CID.parse(u._id))
                this.allocator.removePin(u._id, u.last_updated, true)
            } catch {}
        }

        Logger.log('Synced '+message.pins.length+' pins and '+message.unpins.length+' unpins', 'storage-cluster')

        if (!message || !message.pins?.length) {
            return
        }

        this.requestSync(
            message.pins?.length > 0 ? message.pins[message.pins.length - 1]?.created_at ?? new Date().getTime()+100000 : new Date().getTime()+100000,
            message.unpins?.length > 0 ? message.unpins[message.unpins.length - 1]?.last_updated ?? new Date().getTime()+100000: new Date().getTime()+100000
        )
    }

    /**
     * Handle incoming socket messages targeted towards this peer
     * @param message SocketMsg object
     */
    private async handleSocketMsg(message: SocketMsg) {
        switch (message.type) {
            case SocketMsgTypes.PIN_ALLOCATION:
                await this.handlePinAlloc(message.data as SocketMsgPinAlloc, message.ts)
                break
            case SocketMsgTypes.SYNC_RESP:
                await this.responseSync(message.data as SocketMsgSyncResp)
                break
            default:
                break
        }
    }

    /**
     * Initialize WebSocket connection to a peer
     * @param isDiscovery Whether peer is known through discovery
     * @param wsUrl WS URL of the peer
     */
    private initWs(isDiscovery: boolean, wsUrl: string) {
        if (!wsUrl) {
            if (isDiscovery)
                throw new Error('no WS URL for discovered peer, this should not happen')
            this.sendPeerInfo()
            return // first peer does not require wsUrl for now, but add the urls of other peers when they join the cluster later
        }
        let ws = new WebSocket(wsUrl)
        let peerId: string
        ws.on('error', (err) => Logger.error(err, 'storage-peer'))
        ws.on('open', async () => {
            ws.send(JSON.stringify({
                type: SocketMsgTypes.AUTH,
                data: {
                    secret: this.secret,
                    peerId: this.getPeerId(),
                    discovery: this.wsDiscovery
                },
                ts: new Date().getTime()
            }))
        })
        ws.on('message', async (data) => {
            let message: SocketMsg
            try {
                message = JSON.parse(data.toString())
            } catch {
                return
            }
            if (!message || typeof message.type === 'undefined' || !message.data)
                return

            if (message.type === SocketMsgTypes.AUTH_SUCCESS) {
                let allocPeerInfo = message.data as SocketMsgAuthSuccess
                this.allocator.addPeer(allocPeerInfo.peerId, ws, wsUrl)
                this.allocator.setPeerSynced(allocPeerInfo.peerId)
                peerId = allocPeerInfo.peerId
                ws.on('close', () => {
                    this.allocator.wsClosed(allocPeerInfo.peerId)
                })
                if (!isDiscovery) {
                    Logger.log('Authentication success', 'storage-peer')
                    for (const p of allocPeerInfo.discoveryPeers)
                        if (p !== this.wsDiscovery)
                            this.initWs(true, p)
                    setTimeout(async () => this.requestSync(
                        await this.allocator.getLatestPin(),
                        await this.allocator.getLatestUnpin()
                    ), 2000)
                } else
                    Logger.debug('Discovered peer '+allocPeerInfo.peerId, 'storage-peer')
            }

            if (peerId) {
                // handle this peer's messages from allocators connected outbound
                await this.handleSocketMsg(message)

                // handle allocator messages (including gossips) from peers connected outbound
                await this.allocator.handleSocketMsg(message, peerId, new Date().getTime())
            }
        })
    }

    /**
     * Invocation function for the storage peer
     */
    start() {
        this.initWs(false, this.wsUrl)
        this.allocator.start()
    }
}