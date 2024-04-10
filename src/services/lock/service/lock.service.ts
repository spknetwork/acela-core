import distance from 'xor-distance'
import Crypto from 'crypto'
import { Ed25519Provider } from "key-did-provider-ed25519";
import KeyResolver from 'key-did-resolver'
import { DID } from 'dids'
import moment from "moment";
import { Injectable, Logger } from "@nestjs/common";
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
    readonly #logger: Logger = new Logger(LockService.name);

    constructor(private lockRepository: LockRepository, private lockNodeRepository: LockNodeRepository) { }

    async nextNodeSelection(start_id: string) {
        const nodes = await this.lockNodeRepository.distinct('node_id')
        const nodesClosest = nodes.map(e => {
            let distance = 0;
            let i = 0;
            // Ensure both e and start_id are valid, else return a tuple with a high distance value to sort later
            if (!e || !start_id) return [Number.MAX_SAFE_INTEGER, start_id];
            const min = Math.min(start_id.length, e.length)
            const max = Math.max(start_id.length, e.length)
            for (; i < min; ++i) {
                distance = distance * 256 + ((start_id as any)[i] ^ e[i])
            }
            for (; i < max; ++i) distance = distance * 256 + 255
            return [distance, e]
        }).sort((a, b) => a[0] - b[0])
        const date = new Date();
        if (!nodesClosest.length) return start_id
        // Safely access the selected node, ensuring we don't accidentally access undefined
        const selectedNode = nodesClosest[date.getMinutes() % nodesClosest.length];
        return selectedNode ? selectedNode[1] : start_id;
    }

    /**
     * Executes a given task with lock control to prevent concurrent execution.
     * @param {string} taskId - A unique identifier for the task.
     * @param {Function} task - A callback function representing the task to be executed.
     */
    async executeWithLock(taskId: string, task: () => Promise<void>): Promise<void> {
        const lockId = `${taskId}`;
        try {
            let canExecute
            try {
                canExecute = await this.registerLock(lockId);
            } catch {
                this.#logger.log(`Lock for ${taskId} is currently held by another instance. Skipping execution.`);
                return;
            }
            if (!canExecute) {
                this.#logger.log(`Lock for ${taskId} is currently held by another instance. Skipping execution.`);
                return;
            }

            return await task(); // Execute the task

            // Optionally, you can decide if the lock should be released immediately after the task
            // or if it should be held until the next execution cycle.
            // await this.unregisterLock(lockId);
        } catch (error) {
            this.#logger.error(`Failed to execute task ${taskId}.`, error.stack);
            await this.unregisterLock(lockId); // Ensure the lock is released even if an error occurs
        }
    }

    async registerHandle(id: string, handler: Function) {
        this.regSrv[id] = {
            handler
        }
    }

    async registerLock(id: string) {
        const savedLock = await this.lockRepository.findOneById(id);

        // If there's an existing lock not owned by this identity...
        if (savedLock && savedLock.registered_id !== this.identity.id) {
            const isLockStale = moment(savedLock.registered_ping).add(1, 'minutes').isBefore(moment());

            // If the lock is not stale, it's an immediate error condition.
            const selected_id = await this.nextNodeSelection(savedLock.registered_id);
            if (!isLockStale && selected_id !== this.identity.id) {
                throw new Error('Service already registered by another node');
            }
        }

        const lock = await this.lockRepository.findOneByIdAndUpdateRegisteredIdOrCreate({
            id,
            registered_id: this.identity.id
        });

        this.#logger.log(`This node is currently registered as lock keeper for ${id}`);

        this.registeredLocks[id] = {}

        return lock;
    }


    /**
     * Unregisters a previously acquired lock, making it available for other instances.
     * @param {string} id - The unique identifier of the lock to be unregistered.
     */
    async unregisterLock(id: string): Promise<void> {
        const lock = await this.lockRepository.findOneById(id);

        // Check if the lock exists and is registered to the current instance
        if (lock && lock.registered_id === this.identity.id) {
            // Option 1: Set the registered_id to null, indicating the lock is free
            await this.lockRepository.findOneByIdAndUpdateRegisteredIdOrIgnore({ id, registered_id: null, registered_ping: null });

            // Option 2: Delete the lock from the repository if locks are treated as ephemeral
            // await this.lockRepository.deleteLock(id);

            delete this.registeredLocks[id]; // Also remove it from the in-memory storage

            this.#logger.log(`Lock ${id} has been successfully unregistered.`);
        } else {
            this.#logger.log(`Lock ${id} is not registered to the current instance. Skipping.`);
        }
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
        for (let srv of runningServices) {

            if (!srv.registered_id) continue
            // console.log(srv)
            const destined_id = await this.nextNodeSelection(srv.registered_id)
            // console.log(destined_id, this.identity.id)
            if (destined_id === this.identity.id) {
                //Can register services
                if (this.regSrv[srv.id]) {
                    await this.registerLock(srv.id)
                    this.regSrv[srv.id].handler()
                    this.registeredLocks[srv.id] = {}
                }
            }
        }
    }

    async registerOwnServices() {
        for (let [id, val] of Object.entries(this.regSrv)) {
            const currentLock = await this.lockRepository.findOneById(id);
            if (!currentLock) {
                await this.registerLock(id)
                this.regSrv[id].handler()
                this.registeredLocks[id] = {}
            }
        }
    }

    async onModuleInit(): Promise<void> {
        this._update_pid = setInterval(async () => {
            for (let [id, lock] of Object.entries(this.registeredLocks)) {
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
        await this.registerSelf()
    }

    async onApplicationShutdown(signal?: string): Promise<void> {
        clearInterval(this._update_pid)
        for (const lock of Object.keys(this.registeredLocks)) {
            await this.unregisterLock(lock)
        }
    }
}