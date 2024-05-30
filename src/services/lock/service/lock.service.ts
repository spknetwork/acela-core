import Crypto from 'crypto';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import KeyResolver from 'key-did-resolver';
import { DID } from 'dids';
import moment from 'moment';
import { Injectable, Logger } from '@nestjs/common';
import { LockRepository } from '../repository/lock.repository';
import { LockNodeRepository } from '../repository/lock-node.repository';
import { LockNode } from '../schemas/lock-node.schema';

interface ServiceLockDb {
  id: string;
  registered_ping: Date;
  registered_id?: string;
}

@Injectable()
export class LockService {
  registeredLocks: Record<string, any> = {};
  regSrv: Record<
    string,
    {
      handler: Function;
    }
  > = {};
  identity: DID;
  readonly #logger: Logger = new Logger(LockService.name);

  constructor(
    private lockRepository: LockRepository,
    private lockNodeRepository: LockNodeRepository,
  ) {}

  async nextNodeSelection(start_id: string) {
    const nodes = await this.lockNodeRepository.distinct('node_id');
    const nodesClosest = nodes
      .map<[number, string]>((e: LockNode): [number, string] => {
        let distance: number = 0;
        let i = 0;
        if (!e || !start_id || !e.node_id) return [Number.MAX_SAFE_INTEGER, start_id];
        const min = Math.min(start_id.length, e.node_id.length);
        const max = Math.max(start_id.length, e.node_id.length);
        for (; i < min; ++i) {
          distance = distance * 256 + (start_id.charCodeAt(i) ^ e.node_id.charCodeAt(i));
        }
        for (; i < max; ++i) distance = distance * 256 + 255;
        return [distance, e.node_id];
      })
      .sort((a, b) => a[0] - b[0]);
    const date = new Date();
    if (!nodesClosest.length) return start_id;
    const selectedNode = nodesClosest[date.getMinutes() % nodesClosest.length];
    return selectedNode ? selectedNode[1] : start_id;
  }

  async executeWithLock(taskId: string, task: () => Promise<void>): Promise<void> {
    const lockId = `${taskId}`;
    try {
      let canExecute;
      try {
        canExecute = await this.registerLock(lockId);
      } catch {
        this.#logger.log(
          `Lock for ${taskId} is currently held by another instance. Skipping execution.`,
        );
        return;
      }
      if (!canExecute) {
        this.#logger.log(
          `Lock for ${taskId} is currently held by another instance. Skipping execution.`,
        );
        return;
      }

      return await task(); // Execute the task
    } catch (error) {
      this.#logger.error(`Failed to execute task ${taskId}.`, error.stack);
      await this.unregisterLock(lockId); // Ensure the lock is released even if an error occurs
    }
  }

  async registerHandle(id: string, handler: Function) {
    this.regSrv[id] = {
      handler,
    };
  }

  async registerLock(id: string) {
    const savedLock = await this.lockRepository.findOneById(id);

    if (savedLock && savedLock.registered_id && savedLock.registered_id !== this.identity.id) {
      const isLockStale = moment(savedLock.registered_ping).add(1, 'minutes').isBefore(moment());
      const selected_id = await this.nextNodeSelection(savedLock.registered_id);
      if (!isLockStale && selected_id !== this.identity.id) {
        throw new Error('Service already registered by another node');
      }
    }

    const lock = await this.lockRepository.findOneByIdAndUpdateRegisteredIdOrCreate({
      id,
      registered_id: this.identity.id,
    });

    this.#logger.log(`This node is currently registered as lock keeper for ${id}`);
    this.registeredLocks[id] = {};

    return lock;
  }

  async unregisterLock(id: string): Promise<void> {
    const lock = await this.lockRepository.findOneById(id);

    if (lock && lock.registered_id === this.identity.id) {
      await this.lockRepository.findOneByIdAndMakeInactiveIfExists({ id });
      delete this.registeredLocks[id];
      this.#logger.log(`Lock ${id} has been successfully unregistered.`);
    } else {
      this.#logger.log(`Lock ${id} is not registered to the current instance. Skipping.`);
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      const key = new Ed25519Provider(Crypto.randomBytes(32));
      this.identity = new DID({ provider: key, resolver: KeyResolver.getResolver() });
      await this.identity.authenticate();
      await this.lockNodeRepository.findOneAndRenewOrCreate(this.identity.id);
    } catch (error) {
      this.#logger.error('Failed to initialize LockService', error.stack);
    }
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    for (const lock of Object.keys(this.registeredLocks)) {
      await this.unregisterLock(lock);
    }
  }
}
