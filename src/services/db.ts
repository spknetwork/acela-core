import { MongoClient } from 'mongodb'
import { Schema } from 'mongoose'
import 'dotenv/config'


const CORE_MONGODB_URL = process.env.CORE_MONGODB_URL || '127.0.0.1:27017'

export const MONGODB_URL = `mongodb://${CORE_MONGODB_URL}`
export const mongo = new MongoClient(MONGODB_URL)

const Users = new Schema({})

Users.index({
    username: -1
})