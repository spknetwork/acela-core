import { Client } from '@hiveio/dhive'

export const HiveClient = new Client(process.env.HIVE_HOST?.split(',') || ["https://anyx.io", "https://hived.privex.io", "https://rpc.ausbit.dev", "https://techcoderx.com", "https://api.openhive.network", "https://api.hive.blog", "https://api.c0ff33a.uk"])
