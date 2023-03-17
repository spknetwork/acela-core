import { Db, MongoClient, Collection } from 'mongodb'
<<<<<<< HEAD
import { HiveAccountCreation } from '../types/auth';
import { UserForDApps } from '../types/userfordapps';
=======
import { AuthSession, HiveAccountCreation } from '../types/auth';
>>>>>>> 9ec988d43553f2aa80ba02a01d9c5c2f6832fd61
import { CommsCore } from './comms';
import { VoterCore } from './comms/voter';
import { MONGODB_URL } from './db';
import { HealthCheckCore } from './health';
import { LockService } from './lock-service';
import { StorageEngine } from './storage-engine';
import { VideoService } from './video-service';
import { Video } from '../types/video';



export class AcelaCore {
    db: Db;
    usersDb: Collection;
    commitLog: Collection;
    unionDb: Db;
    delegatedAuthority: Collection;
    linkedAccountsDb: Collection;
    hiveAccountsDb: Collection<HiveAccountCreation>;
<<<<<<< HEAD
    userForDAppsDb: Collection<UserForDApps>;
    videosDb: Collection<Video>;
=======
    authSessions: Collection<AuthSession>
>>>>>>> 9ec988d43553f2aa80ba02a01d9c5c2f6832fd61
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
        this.hiveAccountsDb = this.db.collection<HiveAccountCreation>('hive-accounts')
        this.userForDAppsDb = this.db.collection<UserForDApps>('user-for-dapps')
        this.commitLog = this.db.collection('commit-log')
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