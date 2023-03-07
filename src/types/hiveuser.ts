import { ObjectId } from 'mongodb'

export interface HiveUserForDApps {
  userid: string
  network: string
  banned: boolean
}
