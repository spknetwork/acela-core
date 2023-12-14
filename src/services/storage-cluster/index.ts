import { StorageClusterAllocator } from './allocator.js'
import { StorageClusterPeer } from './peer.js'
import { mongo } from '../db.js'
import { create } from 'kubo-rpc-client'

const printHelp = () => {
    let path = process.argv[1]
    if (path.startsWith(process.cwd()+'/'))
        path = path.replace(process.cwd()+'/','')
    console.log(`Usage:
    
  Allocator node:
    node ${path} allocator <db_name>
  
  Peer node:
    node ${path} peer <db_name>`)
}

if (process.argv.length < 4) {
    printHelp()
    process.exit(1)
}

const nodeType = process.argv[2]
const dbName = process.argv[3]

await mongo.connect()

const db = mongo.db(dbName)

if (nodeType === 'allocator') {
    const allocator = new StorageClusterAllocator(db, process.env.IPFS_CLUSTER_SECRET, process.env.IPFS_CLUSTER_WSS_PORT)
    allocator.start()
} else if (nodeType === 'peer') {
    const ipfs = create({
        url: process.env.IPFS_CLUSTER_KUBO_API || 'http://localhost:5001'
    })
    const peer = new StorageClusterPeer(db, process.env.IPFS_CLUSTER_SECRET, ipfs, process.env.IPFS_CLUSTER_PEER_ID, process.env.IPFS_CLUSTER_WS_URL || '', process.env.IPFS_CLUSTER_PATH)
    peer.start()
} else {
    printHelp()
    process.exit(1)
}