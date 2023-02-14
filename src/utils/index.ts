import { Client } from '@hiveio/dhive'

export const HiveClient = new Client(process.env.HIVE_HOST?.split(',') || ["https://api.deathwing.me"])
