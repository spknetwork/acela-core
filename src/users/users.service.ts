import { Injectable } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb'
import {MONGODB_URL} from '../services/db'

export type User = any;

@Injectable()
export class UsersService {
    
  async findOne(username: string): Promise<User | undefined> {
    const url = MONGODB_URL
    const mongo = new MongoClient(url)
    await mongo.connect()
    const db = mongo.db('acela-core-db')
    const collAcelaUsers = db.collection('acelaUsers')
    const query = { user_name: username };
    const acelaUser = await collAcelaUsers.findOne(query);

    return acelaUser;
  }

  async registerNewUser(username: string, password: string): Promise<User | undefined> {
    const url = MONGODB_URL
    const mongo = new MongoClient(url)
    await mongo.connect()
    const db = mongo.db('acela-core-db')
    const collAcelaUsers = db.collection('acelaUsers')
    const query = { user_name: username, password: password };
    const acelaUser = await collAcelaUsers.insertOne(query);
     
    return acelaUser;
  }    
}
