import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { appContainer } from '.';

@Injectable()
export class ApiService {}

export type User = any;

@Injectable()
export class UsersService {
    
  async findOne(username: string): Promise<User | undefined> {
    const query = { email: username };
    const acelaUser = await appContainer.self.usersDb.findOne(query);
    console.log(acelaUser)

    return acelaUser;
  }
}
