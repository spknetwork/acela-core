declare global {
  namespace NodeJS {
    interface ProcessEnv {
        CORE_MONGODB_URL: string
        CORE_MONGODB_PARAMS: string
        INDEXER_MONGODB_URL: string

        DELEGATED_ACCOUNT: string
        DELEGATED_ACCOUNT_POSTING: string
        DELEGATED_ACCOUNT_ACTIVE: string

        ACCOUNT_CREATOR: string
        ACCOUNT_CREATOR_ACTIVE: string

        VOTER_ACCOUNT: string
        VOTER_ACCOUNT_POSTING: string

        CAPTCHA_SITE_KEY: string
        CAPTCHA_SECRET: string

        ENCODER_SECRET: string
        ENCODER_API: string
        ENCODER_IPFS_GATEWAY: string

        JWT_PRIVATE_KEY: string

        HIVE_ONBOARD_TOKEN: string
        
        IPFS_CLUSTER_URL: string
        IPFS_CLUSTER_DB_NAME: string
        IPFS_CLUSTER_SECRET: string
        IPFS_CLUSTER_WS_DISCOVERY: string
        IPFS_CLUSTER_WS_URL: string
        IPFS_CLUSTER_WSS_PORT: number
        IPFS_CLUSTER_PATH: string
        IPFS_CLUSTER_KUBO_API: string
        IPFS_CLUSTER_PEER_ID: string
        IPFS_CLUSTER_NEST_API_ENABLE: string

        MAIL_GUN_KEY: string
        MAIL_GUN_SECRET: string
        MAIL_GUN_DOMAIN: string

        SERVER_NAME: string

        DISCORD_TOKEN: string

        PLATFORM_ID: string
    }
  }
}

export {}