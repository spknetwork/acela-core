import { Db, MongoClient, Collection } from 'mongodb'
import { HiveAccountCreation } from '../types/auth';
import { MONGODB_URL } from './db';


export class AcelaCore {
    db: Db;
    usersDb: Collection;
    commitLog: Collection;
    unionDb: Db;
    delegatedAuthority: Collection;
    linkedAccountsDb: Collection;
    hiveAccountsDb: Collection<HiveAccountCreation>;


    async start() {
        const connection = new MongoClient(MONGODB_URL)
        await connection.connect();

        this.db = connection.db('acela-core')
        this.usersDb = this.db.collection('users')
        this.linkedAccountsDb = this.db.collection('linked_accounts')
        this.hiveAccountsDb = this.db.collection<HiveAccountCreation>('hive_accounts')
        this.commitLog = this.db.collection('commit-log')

        this.unionDb = connection.db('spk-union-indexer')
        this.delegatedAuthority = this.unionDb.collection('delegated-authority')
    }
}