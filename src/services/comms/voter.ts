import { PrivateKey } from "@hiveio/dhive";
import moment from "moment";
import { AcelaCore } from "..";
import { HiveClient } from "../../utils";

export class VoterCore {
    self: AcelaCore;
    constructor(self: AcelaCore) {
        this.self = self;
    }
    
    async voteRound() {
        // const posts = await this.self.unionDb.collection('posts')

        // const lastDayPosts = posts.find({
        //     created_at: {$gt: moment().subtract('1', 'day').toDate()},
        //     "json_metadata.app": {$regex: "3speak"},
        //     // parent_permlink: ""
        // })
        // console.log(lastDayPosts)

        // for await(let post of lastDayPosts) {
        //     console.log(post)
        //     try {
        //         // const voteOp = await HiveClient.broadcast.vote({
        //         //     voter: process.env.VOTER_ACCOUNT,
        //         //     author: post.author,
        //         //     permlink: post.permlink,
        //         //     weight: 1_000
        //         // }, PrivateKey.fromString(process.env.VOTER_ACCOUNT_POSTING))
        //         // console.log(voteOp)
        //     } catch {

        //     }
        // }
    }

    async start() {

    }
}