import { Db } from 'mongodb'
import WebSocket from 'ws'
import disk from 'diskusage'
import { ALLOCATION_DISK_THRESHOLD, SocketMsg, SocketMsgPin, SocketMsgPinAlloc, SocketMsgTypes, StorageCluster } from './types.js'
import { Logger } from '@nestjs/common'
import { multiaddr, CID } from 'kubo-rpc-client'
import type { IPFSHTTPClient } from 'kubo-rpc-client'
import type { Multiaddr } from 'kubo-rpc-client/dist/src/types.js'

export class StorageClusterPeer extends StorageCluster {
    private ws: WebSocket
    ipfs: IPFSHTTPClient
    peerId: Multiaddr

    constructor(unionDb: Db, secret: string, ipfs: IPFSHTTPClient, peerId: string) {
        super(unionDb, secret)
        this.ipfs = ipfs
        this.peerId = multiaddr(peerId)
    }

    async getDiskInfo() {
        return await disk.check(process.env.IPFS_CLUSTER_PATH)
    }

    getIpfsApiUrl() {
        const ipfsEndpoint = this.ipfs.getEndpointConfig()
        return ipfsEndpoint.protocol+'//'+ipfsEndpoint.host+':'+ipfsEndpoint.port+ipfsEndpoint['api-path']
    }

    /**
     * Add a pinned CID to the cluster to be pinned by other nodes
     * @param cid CID to be added to the cluster
     */
    async addToCluster(cid: string | CID) {
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
        if (isAdded) {
            Logger.error(cid.toString()+' is already exists in the cluster, ignoring request', 'storage-peer')
            throw new Error('CID already exists in cluster')
        }
        let created_at = new Date().getTime()
        let info = await this.ipfs.files.stat('/ipfs/'+cid.toString())
        await this.pins.insertOne({
            _id: cid.toString(),
            status: 'pinned',
            created_at,
            size: info.cumulativeSize
        })
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_NEW,
            data: {
                cid: cid.toString(),
                size: info.cumulativeSize
            }
        }))
    }

    async unpinFromPeer(cid: string | CID) {
        if (typeof cid === 'string')
            cid = CID.parse(cid)
        await this.pins.updateOne({_id: cid.toString()}, {$set: {
            status: 'unpinned'
        }})
        await this.ipfs.pin.rm(cid)
        Logger.debug('Unpinned '+cid.toString()+' from peer', 'storage-peer')
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_REMOVE_PEER,
            data: {
                cid: cid.toString()
            }
        }))
    }

    private async sendPeerInfo() {
        let diskInfo = await this.getDiskInfo()
        let totalSpaceMB = Math.floor(diskInfo.total/1048576)
        let freeSpaceMB = Math.floor(diskInfo.available/1048576)
        Logger.log('Available disk space: '+Math.floor(freeSpaceMB/1024)+' GB ('+Math.floor(100*freeSpaceMB/totalSpaceMB)+'%), total: '+Math.floor(totalSpaceMB/1024)+' GB', 'storage-peer')
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PEER_INFO,
            data: {
                totalSpaceMB,
                freeSpaceMB
            }
        }))
    }

    private async handlePinAlloc(allocs: SocketMsgPinAlloc) {
        if (allocs.allocations.length === 0) {
            setTimeout(() => this.sendPeerInfo(), 30000)
            return
        }
        Logger.log('Received '+allocs.allocations.length+' pin allocations', 'storage-peer')
        for (let a in allocs.allocations)
            await this.pins.updateOne({
                _id: allocs.allocations[a]._id
            }, {
                $set: {
                    status: 'queued',
                    owner: allocs.allocations[a].owner,
                    permlink: allocs.allocations[a].permlink,
                    network: allocs.allocations[a].network,
                    type: allocs.allocations[a].type,
                    created_at: allocs.allocations[a].created_at
                }
            }, { upsert: true })
        await this.executeIPFSPin(allocs.allocations.map((val) => val._id), allocs.peerIds)
        setTimeout(async () => await this.sendPeerInfo(), 1000)
    }

    private async executeIPFSPin(cids: string[], peerIds: string[]) {
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
                await this.pins.updateOne({
                    _id: cids[cid]
                }, {
                    $set: {
                        status: 'pinned',
                        size: size
                    }
                })
                this.ws.send(JSON.stringify({
                    type: SocketMsgTypes.PIN_COMPLETED,
                    data: {
                        cid: cids[cid],
                        size: size
                    }
                }))
                Logger.debug('Pinned '+cids[cid]+', size: '+size, 'storage-peer')
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
    private async handleUnpinRequest(cid: string) {
        await this.pins.updateOne({_id: cid}, {$set: {
            status: 'deleted'
        }})
        await this.ipfs.pin.rm(CID.parse(cid))
        Logger.debug('Unpinned '+cid, 'storage-peer')
    }

    /**
     * Handle pin failures
     * @param cid CID that failed to pin
     */
    private async pinFailed(cid: string) {
        try {
            await this.pins.updateOne({
                _id: cid
            }, {
                $set: {
                    status: 'failed'
                }
            })
        } catch {}
        this.ws.send(JSON.stringify({
            type: SocketMsgTypes.PIN_FAILED,
            data: {
                cid: cid
            }
        }))
    }

    private initWs() {
        if (!process.env.IPFS_CLUSTER_WS_URL)
            return Logger.warn('IPFS_CLUSTER_WS_URL is not specified, not connecting to storage cluster', 'storage-peer')
        this.ws = new WebSocket(process.env.IPFS_CLUSTER_WS_URL)
        this.ws.on('error', (err) => Logger.error(err, 'storage-peer'))
        this.ws.on('open', async () => {
            this.ws.send(JSON.stringify({
                type: SocketMsgTypes.AUTH,
                data: {
                    secret: this.secret,
                    peerId: this.peerId.toString()
                }
            }))
        })
        this.ws.on('message', async (data) => {
            let message: SocketMsg
            try {
                message = JSON.parse(data.toString())
            } catch {
                return
            }
            if (!message || typeof message.type === 'undefined' || !message.data)
                return

            switch (message.type) {
                case SocketMsgTypes.AUTH_SUCCESS:
                    Logger.log('Authentication success', 'storage-peer')
                    await this.sendPeerInfo()
                    break
                case SocketMsgTypes.PIN_ALLOCATION:
                    await this.handlePinAlloc(message.data as SocketMsgPinAlloc)
                    break
                case SocketMsgTypes.PIN_REMOVE:
                    await this.handleUnpinRequest((message.data as SocketMsgPin).cid)
                    break
                default:
                    break
            }
        })
        this.ws.on('close', (code) => {
            if (code === 1006) {
                Logger.warn('Connection closed abnormally, attempting to reconnect in 10 seconds...', 'storage-peer')
                setTimeout(() => {
                    this.initWs()
                }, 10000)
            }
        })
    }

    start() {
        this.initWs()
    }
}