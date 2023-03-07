import { Collection } from "mongodb"
import distance from 'xor-distance'
import Crypto from 'crypto'
import {Ed25519Provider} from "key-did-provider-ed25519";
import KeyResolver from 'key-did-resolver'
import {DID} from 'dids'

interface ServiceLockDb {
    id: string
    registered_ping: Date
    registered_id?: string
}

export class LockService {
    locks: Collection<ServiceLockDb>
    lockNodes: Collection<any>
    registeredLocks: any[]
    identity: DID;

    constructor(self) {
        this.locks = self.locksDb
        this.lockNodes = self.db.collection('lock_nodes')
        this.registeredLocks = []
    }

    async registerLock() {

    }
    
    async registerSelf() {
        var dist1 = distance(Buffer.from('foo'), Buffer.from('bar'))
        console.log(dist1)
        const nodes = await this.lockNodes.distinct('node_id')
        console.log(nodes)
        const nodesClosest = nodes.map(e => {
            let distance = 0
            let i = 0
            const min = Math.min(this.identity.id.length, e.length)
            const max = Math.max(this.identity.id.length, e.length)
            for (; i < min; ++i) {
                distance = distance * 256 + ((this.identity.id as any)[i] ^ e[i])
            }
            for (; i < max; ++i) distance = distance * 256 + 255
            return [distance, e]
        }).sort((a, b) => {
            return a[0] - b[0]
        }).filter((e) => {
            return e[1] !== this.identity.id
        })
        console.log(nodesClosest)
    }

    async start() {
        
        let key = new Ed25519Provider(Crypto.randomBytes(32))
        this.identity = new DID({ provider: key, resolver: KeyResolver.getResolver() })
        await this.identity.authenticate()
        
        await this.lockNodes.findOneAndUpdate({
            node_id: this.identity.id,
        }, {
            $set: {
                registered_at: new Date()
            }
        }, {
            upsert: true
        })
        this.registerSelf()
    }
}