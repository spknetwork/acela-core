import { Db, MongoClient, Collection } from 'mongodb'


export class AcelaCore {
    db: Db;
    authDb: Collection;


    async start() {
        const connection = new MongoClient(process.env.CORE_MONGODB_URL)
        await connection.connect();

        this.db = connection.db('acela-core')
        this.authDb = this.db.collection('auth')
        
    }
}