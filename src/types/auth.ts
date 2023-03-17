import { ObjectId } from "mongodb"


export interface UserAccountLink {
    status: "unverified" | "verified"
    user_id: string
    account: string
    network: "HIVE" | string
    type: "native" | "hive_keychain" | "hive_auth"
    challenge?: string
}

export interface UserAccount {
    status: "unverified" | "verified" | "active"
    email_status: "unverified" | "verified"
   
    created_at: Date
    updated_at: Date
    last_login_at: Date

    
    // userStatus: string
    // emailVerified: boolean
    // enabled: boolean
    // passwordResetRequested: boolean

    password_reset_at: Date
}

export interface HiveAccountCreation {
    status: 'requested' | 'created' | 'released'
    username: string
    keys_requested: boolean
    created_by: string
    requested_at: Date
    created_at: Date
}

export interface AuthSession {
    id: string
    expires: Date
    date: Date
    type: "singleton" | 'regular'
    sub: string
}