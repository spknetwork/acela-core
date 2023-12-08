import { Db } from 'mongodb'
import WebSocket from 'ws'
import disk from 'diskusage'
import { SocketMsg, SocketMsgTypes, StorageCluster } from './types.js'
import { Logger } from '@nestjs/common'

export class StorageClusterPeer extends StorageCluster {
    ws: WebSocket

    constructor(unionDb: Db, peerId: string) {
        super(unionDb, peerId)
    }

    async getDiskInfo() {
        return await disk.check(process.env.IPFS_CLUSTER_PATH)
    }

    initWs() {
        if (!process.env.IPFS_CLUSTER_WS_URL)
            return Logger.warn('IPFS_CLUSTER_WS_URL is not specified, not connecting to storage cluster', 'storage-cluster')
        this.ws = new WebSocket(process.env.IPFS_CLUSTER_WS_URL)
        this.ws.on('error', (err) => Logger.error(err, 'storage-cluster'))
        this.ws.on('open', () => {
            this.ws.send(JSON.stringify({
                type: SocketMsgTypes.AUTH,
                data: {
                    secret: process.env.IPFS_CLUSTER_SECRET,
                    peerId: this.peerId
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