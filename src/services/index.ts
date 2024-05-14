import { Db, MongoClient, Collection } from 'mongodb';
import * as IPFSHTTPClient from 'kubo-rpc-client';
import os from 'os';
import Path from 'path';
import Crypto from 'crypto';
import { Ed25519Provider } from 'key-did-provider-ed25519';
import { DID } from 'dids';
import KeyResolver from 'key-did-resolver';
import { AuthSession, HiveAccountCreation, UserAccount, UserAccountLink } from '../types/auth';
import { CORE_MONGODB_URL } from './db';
import { HealthCheckCore } from './health';
import { StorageEngine } from './storage-engine';
import { Config } from './config';

export class AcelaCore {
  db: Db;
  usersDb: Collection<UserAccount>;
  linkedAccountsDb: Collection<UserAccountLink>;
  hiveAccountsDb: Collection<HiveAccountCreation>;

  commitLog: Collection;
  unionDb: Db;
  delegatedAuthority: Collection;
  authSessions: Collection<AuthSession>;
  healthChecks: HealthCheckCore;
  uploadsDb: Collection<any>;
  storageEngine: StorageEngine;
  locksDb: Collection;
  localPosts: Collection;
  ipfs: IPFSHTTPClient.IPFSHTTPClient;
  config: Config;
  identity: DID;

  private async setupKeys() {
    for (const key of ['node']) {
      let privateKey: Buffer;
      if (this.config.get(`identity.${key}Private`)) {
        privateKey = Buffer.from(this.config.get(`identity.${key}Private`), 'base64');
      } else {
        privateKey = Crypto.randomBytes(32);
        const hex = privateKey.toString('base64');
        this.config.set(`identity.${key}Private`, hex);
      }
      const keyPrivate = new Ed25519Provider(privateKey);
      const did = new DID({ provider: keyPrivate, resolver: KeyResolver.getResolver() });
      await did.authenticate();
      this.config.set(`identity.${key}Public`, did.id);
      if (key === 'node') {
        this.identity = did;
      }
    }
  }

  async start() {
    const homeDir = Path.join(os.homedir(), '.acela-core');
    this.config = new Config(homeDir);
    await this.config.open();

    await this.setupKeys();

    const connection = new MongoClient(CORE_MONGODB_URL);
    await connection.connect();
    const connection2 = new MongoClient(process.env.INDEXER_MONGODB_URL);
    await connection2.connect();

    this.db = connection.db('acela-core');
    this.usersDb = this.db.collection('users');
    this.linkedAccountsDb = this.db.collection('linked_accounts');
    this.hiveAccountsDb = this.db.collection<HiveAccountCreation>('hive_accounts');
    this.authSessions = this.db.collection('auth_sessions');
    this.commitLog = this.db.collection('commit_log');
    this.uploadsDb = this.db.collection('uploads');
    this.localPosts = this.db.collection('local_posts');
    this.locksDb = this.db.collection('locks');

    this.unionDb = connection2.db('spk-union-indexer');
    this.delegatedAuthority = this.unionDb.collection('delegated-authority');

    //TODO: Move to separate microservice in the future
    this.healthChecks = new HealthCheckCore(this);

    await this.healthChecks.start();

    this.storageEngine = new StorageEngine(this);

    await this.storageEngine.start();

    this.ipfs = IPFSHTTPClient.create();
  }
}
