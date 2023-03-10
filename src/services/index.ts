import { Db, MongoClient, Collection } from 'mongodb'
import { HiveAccountCreation } from '../types/auth';
import { CommsCore } from './comms';
import { VoterCore } from './comms/voter';
import { MONGODB_URL } from './db';
import { HealthCheckCore } from './health';
import { LockService } from './lock-service';
import { StorageEngine } from './storage-engine';
import { VideoService } from './video-service';


export class AcelaCore {
    db: Db;
    usersDb: Collection;
    commitLog: Collection;
    unionDb: Db;
    delegatedAuthority: Collection;
    linkedAccountsDb: Collection;
    hiveAccountsDb: Collection<HiveAccountCreation>;
    healthChecks: HealthCheckCore;
    voter: VoterCore;
    uploadsDb: Collection<any>;
    storageEngine: StorageEngine;
    locksDb: Collection;
    lockService: LockService;
    comms: CommsCore;
    videoService: VideoService;
    localPosts: Collection;


    async start() {
        const connection = new MongoClient(MONGODB_URL)
        await connection.connect();
        const connection2 = new MongoClient(process.env.INDEXER_MONGODB_URL)
        await connection2.connect();

        this.db = connection.db('acela-core')
        this.usersDb = this.db.collection('users')
        this.linkedAccountsDb = this.db.collection('linked_accounts')
        this.hiveAccountsDb = this.db.collection<HiveAccountCreation>('hive_accounts')
        this.commitLog = this.db.collection('commit_log')
        this.uploadsDb = this.db.collection('uploads')
        this.localPosts = this.db.collection('local_posts')
        this.locksDb = this.db.collection('locks')

        this.unionDb = connection2.db('spk-union-indexer')
        this.delegatedAuthority = this.unionDb.collection('delegated-authority')


        this.lockService = new LockService(this);

        await this.lockService.start()

        //TODO: Move to separate microservice in the future
        this.healthChecks = new HealthCheckCore(this)

        await this.healthChecks.start();

        this.voter = new VoterCore(this)

        await this.voter.start()
        
        this.storageEngine = new StorageEngine(this)

        await this.storageEngine.start()

        this.comms = new CommsCore(this)

        await this.comms.start()

        this.videoService = new VideoService(this)

        await this.videoService.start();
    }
}