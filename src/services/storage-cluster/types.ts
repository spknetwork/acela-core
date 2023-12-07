export enum SocketMsgTypes {
    AUTH
}

export type SocketMsg = {
    type: SocketMsgTypes
    data: SocketMsgAuth
}

export type SocketMsgAuth = {
    secret: string
    peerID: string
}