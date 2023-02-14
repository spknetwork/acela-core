

export interface AccountLinkage {
    linked_at: Date
    trx_id: string
}

export interface UserAccount {
    emailVerified: boolean
    enabled: boolean
    userStatus: string
    passwordResetRequested: boolean
}