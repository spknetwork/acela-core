import { Db } from 'mongodb'
import WebSocket from 'ws'
import disk from 'diskusage'
import { ALLOCATION_DISK_THRESHOLD, SocketMsg, SocketMsgPinAlloc, SocketMsgTypes, StorageCluster } from './types.js'
import { Logger } from '@nestjs/common'
import { multiaddr } from 'kubo-rpc-client'
import type { IPFSHTTPClient } from 'kubo-rpc-client'
import type { Multiaddr } from 'kubo-rpc-client/dist/src/types.js'

export class StorageClusterPeer extends StorageCluster {
    ws: WebSocket
    ipfs: IPFSHTTPClient
    peerId: Multiaddr

    constructor(unionDb: Db, ipfs: IPFSHTTPClient, peerId: string) {
        super(unionDb)
        this.ipfs = ipfs
        this.peerId = multiaddr(peerId)
    }

    async getDiskInfo() {
        return await disk.check(process.env.IPFS_CLUSTER_PATH)
    }

    private async sendPeerInfo() {
        let diskInfo = await this.getDiskInfo()
        let totalSpaceMB = Math.floor(diskInfo.total/1048576)
        let freeSpaceMB = Math.floor(diskInfo.available/1048576)
        Logger.log('Available disk space: '+Math.floor(freeSpaceMB/1024)+' GB ('+Math.floor(100*freeSpaceMB/totalSpaceMB)+'%), total: '+Math.floor(totalSpaceMB/1024)+' GB', 'storage-cluster')
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
        Logger.log('Received '+allocs.allocations.length+' pin allocations', 'storage-cluster')
        for (let a in allocs.allocations)
            await this.pins.updateOne({
                _id: allocs.allocations[a]._id
            }, {
                $setOnInsert: {
                    status: 'queued',
                    owner: allocs.allocations[a].owner,
                    permlink: allocs.allocations[a].permlink,
                    network: allocs.allocations[a].network,
                    type: allocs.allocations[a].type,
                    created_at: allocs.allocations[a].created_at
                }
            }, { upsert: true })
        await this.executeIPFSPin(allocs.allocations.map((val) => val._id), allocs.peerIds)
        await this.sendPeerInfo()
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
            if (100*diskInfo.free/diskInfo.total <= ALLOCATION_DISK_THRESHOLD) {
                await this.pinFailed(cids[cid])
                continue
            }
            try {
                await this.ipfs.pin.add(cids[cid])
                let pinned = await this.ipfs.files.stat('/ipfs/'+cids[cid])
                await this.pins.updateOne({
                    _id: cid
                }, {
                    $set: {
                        status: 'pinned'
                    }
                })
                this.ws.send(JSON.stringify({
                    type: SocketMsgTypes.PIN_COMPLETED,
                    data: {
                        cid: cids[cid],
                        size: pinned.cumulativeSize
                    }
                }))
            } catch {
                await this.pinFailed(cids[cid])
            }
        }

        clearInterval(swarmConnect)
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
            return Logger.warn('IPFS_CLUSTER_WS_URL is not specified, not connecting to storage cluster', 'storage-cluster')
        this.ws = new WebSocket(process.env.IPFS_CLUSTER_WS_URL)
        this.ws.on('error', (err) => Logger.error(err, 'storage-cluster'))
        this.ws.on('open', async () => {
            this.ws.send(JSON.stringify({
                type: SocketMsgTypes.AUTH,
                data: {
                    secret: process.env.IPFS_CLUSTER_SECRET,
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
                    Logger.log('Authentication success', 'storage-cluster')
                    await this.sendPeerInfo()
                    break
                case SocketMsgTypes.PIN_ALLOCATION:
                    await this.handlePinAlloc(message.data as SocketMsgPinAlloc)
                    break
                default:
                    break
            }
        })
        this.ws.on('close', (code) => {
            if (code === 1006) {
                Logger.warn('Connection closed abnormally, attempting to reconnect in 10 seconds...')
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