import { ObjectId } from "mongodb"


export interface UserAccountLink {
    status: "UNVERIFIED" | "VERIFIED"
    user_id: ObjectId
    account: string
    network: "HIVE" | string
}

export interface UserAccount {
    status: "unverified" | "verified" | "active"
    email_verification: "unverified" | "verified"
   
    created_at: Date
    updated_at: Date
    last_login_at: Date

    
    userStatus: string
    emailVerified: boolean
    enabled: boolean
    passwordResetRequested: boolean
}