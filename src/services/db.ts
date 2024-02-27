import { MongoClient } from 'mongodb'
import { Schema } from 'mongoose'
import 'dotenv/config'


export const CORE_MONGODB_URL = process.env.CORE_MONGODB_URL || 'mongodb://localhost:27017'

export const mongo = new MongoClient(CORE_MONGODB_URL)

const Users = new Schema({})

Users.index({
    username: -1
})