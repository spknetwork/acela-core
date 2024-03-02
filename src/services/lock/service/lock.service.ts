import distance from 'xor-distance'
import Crypto from 'crypto'
import {Ed25519Provider} from "key-did-provider-ed25519";
import KeyResolver from 'key-did-resolver'
import {DID} from 'dids'
import moment from "moment";
import { Injectable } from "@nestjs/common";
import { LockRepository } from "../repository/lock.repository";
import { LockNodeRepository } from "../repository/lock-node.repository";

interface ServiceLockDb {
    id: string
    registered_ping: Date
    registered_id?: string
}

@Injectable()
export class LockService {
    registeredLocks: Record<string, any> = {};
    regSrv: Record<string, {
        handler: Function
    }> = {};
    identity: DID;
    private _update_pid: ReturnType<typeof setTimeout>;

    constructor(private lockRepository: LockRepository, private lockNodeRepository: LockNodeRepository) {}

    async nextNodeSelection(start_id: string) {
        const nodes = await this.lockNodeRepository.distinct('node_id')
        const nodesClosest = nodes.map(e => {
            let distance = 0
            let i = 0
            const min = Math.min(start_id.length, e.length)
            const max = Math.max(start_id.length, e.length)
            for (; i < min; ++i) {
                distance = distance * 256 + ((start_id as any)[i] ^ e[i])
            }
            for (; i < max; ++i) distance = distance * 256 + 255
            return [distance, e]
        }).sort((a, b) => {
            return a[0] - b[0]
        })
        /*.filter((e) => {
            return e[1] !== start_id
        })*/
        const date = new Date();
        return nodesClosest[date.getMinutes() % nodesClosest.length][1]
    }

    async registerHandle(id: string, handler: Function) {
        this.regSrv[id] = {
            handler
        }
    }

    async registerLock(id: string) {
        const savedLock = await this.lockRepository.findOneById(id);

        if(savedLock) {
            if(savedLock.registered_id !== this.identity.id) {
                if(savedLock.registered_ping < moment().subtract('10', 'minute').toDate()) {
                    const selected_id = await this.nextNodeSelection(savedLock.registered_id);
                    if(selected_id !== this.identity.id) {
                        throw new Error('Service already registered by another node')
                    }
                } else {
                    throw new Error('Service already registered by another node')
                }
            }
        }

        await this.lockRepository.findOneByIdAndUpdateRegisteredIdOrCreate({
            id,
            registered_id: this.identity.id
        });

        this.registeredLocks[id] = {}
    }
    

    async unregisterLock(id: string) {
        
    }
    
    async registerSelf() {
        var dist1 = distance(Buffer.from('foo'), Buffer.from('bar'))
        const nodes = await this.lockNodeRepository.distinct('node_id')
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
        const date = new Date();
        const nodeReady = nodesClosest[date.getMinutes() % nodesClosest.length]
        // console.log('nodeReady', nodeReady)
        // if(nodeReady[1] === this.identity.id) {
        //     console.log('Can register services')
        // }
    } 

    /**
     * Attempts to reactivate services that are dead and activating fail over.
     */
    async faultCheck() {
        // Logger.info('fault checking')
        const runningServices = await this.lockRepository.fetchServicesLastPingedBefore10Minutes()
        // console.log(runningServices)
        for(let srv of runningServices) {
            // console.log(srv)
            const destined_id = await this.nextNodeSelection(srv.registered_id)
            // console.log(destined_id, this.identity.id)
            if(destined_id === this.identity.id) {
                //Can register services
                if(this.regSrv[srv.id]) {
                    await this.registerLock(srv.id)
                    this.regSrv[srv.id].handler()
                    this.registeredLocks[srv.id] = {}
                }
            }
        }
    }

    async registerOwnServices() {
        for(let [id, val] of Object.entries(this.regSrv)) {
            const currentLock = await this.lockRepository.findOneById(id);
            if(!currentLock) {
                await this.registerLock(id)
                this.regSrv[id].handler()
                this.registeredLocks[id] = {}
            }
        }
    }

    async onModuleInit(): Promise<void> {
        this._update_pid = setInterval(async() => {
            for(let [id, lock] of Object.entries(this.registeredLocks)) {
                await this.lockRepository.findOneByIdAndUpdateRegisteredIdOrIgnore({
                    id,
                    registered_id: this.identity.id
                })
            }

            await this.faultCheck()
            await this.registerOwnServices();
        }, 60 * 1000)

        
        let key = new Ed25519Provider(Crypto.randomBytes(32))
        this.identity = new DID({ provider: key, resolver: KeyResolver.getResolver() })
        await this.identity.authenticate()

        // console.log( await this.lockNodes.distinct('node_id'))
        // const jwe = await this.identity.createJWE(Buffer.from(JSON.stringify({
        //     hello: "world"
        // })), [
        //     ...await this.lockNodes.distinct('node_id'),
        //     this.identity.id
        // ])
        // console.log(Buffer.from(await this.identity.decryptJWE(jwe)).toString())
        // console.log(JSON.stringify(jwe, null, 2))
        
        await this.lockNodeRepository.findOneAndRenewOrCreate(this.identity.id)
        this.registerSelf()
    }

    async onApplicationShutdown(signal?: string): Promise<void> {
        clearInterval(this._update_pid)
    }
}