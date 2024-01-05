import { Db } from 'mongodb'
import WebSocket from 'ws'
import disk from 'diskusage'
import { ALLOCATION_DISK_THRESHOLD, PinMetadata, SocketMsg, SocketMsgAuthSuccess, SocketMsgPin, SocketMsgPinAlloc, SocketMsgTypes, StorageCluster } from './types.js'
import { Logger } from '@nestjs/common'
import { multiaddr, CID } from 'kubo-rpc-client'
import type { IPFSHTTPClient } from 'kubo-rpc-client'
import { StorageClusterAllocator } from './allocator.js'

export class StorageClusterPeer extends StorageCluster {
    private ws: WebSocket
    private wsUrl: string
    private ipfs: IPFSHTTPClient
    private ipfsPath: string
    private wsDiscovery: string
    private allocator: StorageClusterAllocator

    constructor(unionDb: Db, secret: string, ipfs: IPFSHTTPClient, ipfsPath: string, peerId: string, wsUrl: string, wsPort: number, wsDiscovery?: string) {
        if (wsUrl && !wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://'))
            throw new Error('wsUrl must start with ws:// or wss://')
        super(unionDb, secret, peerId)
        this.ipfs = ipfs
        this.wsUrl = wsUrl
        this.ipfsPath = ipfsPath
        this.wsDiscovery = wsDiscovery
        this.allocator = new StorageClusterAllocator(this.unionDb, this.secret, this.peerId.toString(), wsPort, this.handleSocketMsg)
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
    async addToCluster(cid: string | CID, metadata?: PinMetadata) {
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
        await this.pins.updateOne({
            _id: cid.toString()
        }, { $set: {
            status: 'pinned',
            created_at,
            last_updated: created_at,
            allocations: [{
                id: this.peerId.toString(),
                allocated_at: created_at,
                pinned_at: created_at,
                reported_size: info.cumulativeSize
            }],
            allocationCount: 1,
            size: info.cumulativeSize,
            median_size: info.cumulativeSize,
            metadata
        }}, {
            upsert: true
        })
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_NEW,
            data: {
                cid: cid.toString(),
                size: info.cumulativeSize,
                metadata
            },
            ts: created_at
        }))
    }

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
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_REMOVE_PEER,
            data: {
                cid: cid.toString()
            },
            ts: unpinnedTs
        }))
    }

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
        for (let a in allocs.allocations) {
            let exists = await this.pins.findOne({_id: allocs.allocations[a]._id, 'allocations.id': this.peerId.toString()})
            if (!exists)
                await this.pins.updateOne({
                    _id: allocs.allocations[a]._id
                }, {
                    $setOnInsert: {
                        created_at: allocs.allocations[a].created_at,
                        metadata: {
                            owner: allocs.allocations[a].owner,
                            permlink: allocs.allocations[a].permlink,
                            network: allocs.allocations[a].network,
                            type: allocs.allocations[a].type,
                        }
                    },
                    $set: {
                        status: 'queued',
                        last_updated: msgTs
                    },
                    $push: {
                        allocations: {
                            id: this.peerId.toString(),
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

        for (let cid in cids) {
            let diskInfo = await this.getDiskInfo()
            if ((100*diskInfo.free/diskInfo.total) <= ALLOCATION_DISK_THRESHOLD) {
                await this.pinFailed(cids[cid])
                continue
            }
            try {
                let pinned = await this.ipfs.pin.add(cids[cid])
                let size: number
                if (pinned.code === 0x70) {
                    size = (await this.ipfs.files.stat('/ipfs/'+cids[cid])).cumulativeSize
                } else if (pinned.code === 0x71) {
                    // why does ipfs.dag.stat() not exist
                    let apiRes = (await (await fetch(this.getIpfsApiUrl()+'/dag/stat?arg='+cids[cid], {
                        method: 'POST'
                    })).text()).trim().split('\n')
                    size = JSON.parse(apiRes[apiRes.length-1]).TotalSize as number
                }
                let pinnedTs = new Date().getTime()
                await this.pins.updateOne({
                    _id: cids[cid],
                    'allocations.id': this.peerId.toString()
                }, {
                    $set: {
                        status: 'pinned',
                        last_updated: pinnedTs,
                        size: size,
                        median_size: size,
                        'allocations.$': {
                            id: this.peerId.toString(),
                            allocated_at: allocatedTs,
                            pinned_at: pinnedTs,
                            reported_size: size
                        }
                    }
                })
                this.ws.send(JSON.stringify({
                    type: SocketMsgTypes.PIN_COMPLETED,
                    data: {
                        cid: cids[cid],
                        size: size
                    },
                    ts: pinnedTs
                }))
                Logger.log('Pinned '+cids[cid]+', size: '+size, 'storage-peer')
            } catch (e) {
                Logger.verbose(e)
                await this.pinFailed(cids[cid])
            }
        }

        clearInterval(swarmConnect)
    }

    /**
     * Handle unpin request from allocator
     * @param cid CID to unpin
     */
    private async handleUnpinRequest(cid: string, msgTs: number) {
        await this.pins.updateOne({_id: cid}, {$set: {
            status: 'deleted',
            last_updated: msgTs
        }})
        await this.ipfs.pin.rm(CID.parse(cid))
        Logger.debug('Unpinned '+cid, 'storage-peer')
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
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_FAILED,
            data: {
                cid: cid
            },
            ts: failedTs
        }))
    }

    private async handleSocketMsg(message: SocketMsg) {
        switch (message.type) {
            case SocketMsgTypes.PIN_ALLOCATION:
                await this.handlePinAlloc(message.data as SocketMsgPinAlloc, message.ts)
                break
            case SocketMsgTypes.PIN_REMOVE:
                await this.handleUnpinRequest((message.data as SocketMsgPin).cid, message.ts)
                break
            default:
                break
        }
    }

    private initWs(isDiscovery: boolean, wsUrl: string) {
        if (!wsUrl)
            return // first peer does not require wsUrl for now, but add the urls of other peers when they join the cluster later
        let ws = new WebSocket(wsUrl)
        ws.on('error', (err) => Logger.error(err, 'storage-peer'))
        ws.on('open', async () => {
            ws.send(JSON.stringify({
                type: SocketMsgTypes.AUTH,
                data: {
                    secret: this.secret,
                    peerId: this.peerId.toString(),
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
                ws.on('close', () => {
                    this.allocator.wsClosed(allocPeerInfo.peerId)
                })
                if (!isDiscovery) {
                    Logger.log('Authentication success', 'storage-peer')
                    for (let p in allocPeerInfo.discoveryPeers)
                        if (allocPeerInfo.discoveryPeers[p] !== this.wsDiscovery)
                            this.initWs(true, allocPeerInfo.discoveryPeers[p])
                    setTimeout(() => this.sendPeerInfo(), 2000)
                } else
                    Logger.debug('Discovered peer '+allocPeerInfo.peerId, 'storage-peer')
            }

            // handle this peer's messages from allocators connected outbound
            await this.handleSocketMsg(message)

            // handle allocator messages (including gossips) from peers connected outbound
            await this.allocator.handleSocketMsg(message, this.peerId.toString(), new Date().getTime())
        })
        if (!isDiscovery)
            this.ws = ws
    }

    start() {
        this.initWs(false, this.wsUrl)
        this.allocator.start()
    }
}