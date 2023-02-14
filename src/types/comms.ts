export interface CommitLogEntry {
    type: "vote" | string
    args: {
        owner: string
        permlink: string
    }
    account: string
}