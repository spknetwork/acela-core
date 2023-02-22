import { Db, MongoClient, Collection } from 'mongodb'
import { HiveAccountCreation } from '../types/auth';
import { VoterCore } from './comms/voter';
import { MONGODB_URL } from './db';
import { HealthCheckCore } from './health';


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


    async start() {
        const connection = new MongoClient(MONGODB_URL)
        await connection.connect();
        const connection2 = new MongoClient(process.env.INDEXER_MONGODB_URL)
        await connection2.connect();

        this.db = connection.db('acela-core')
        this.usersDb = this.db.collection('users')
        this.linkedAccountsDb = this.db.collection('linked_accounts')
        this.hiveAccountsDb = this.db.collection<HiveAccountCreation>('hive_accounts')
        this.commitLog = this.db.collection('commit-log')

        this.unionDb = connection2.db('spk-union-indexer')
        this.delegatedAuthority = this.unionDb.collection('delegated-authority')

        //TODO: Move to separate microservice in the future
        this.healthChecks = new HealthCheckCore(this)

        await this.healthChecks.start();

        this.voter = new VoterCore(this)

        await this.voter.voteRound()

    }
}