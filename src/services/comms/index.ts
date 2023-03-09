import NodeSchedule from 'node-schedule'
import { AcelaCore } from "..";





export class CommsCore {
    self: AcelaCore;
    constructor(self: AcelaCore) {
        this.self = self;

        this.syncPosts = this.syncPosts.bind(this)
    }


    async syncPosts() {
        console.log("Syncing Posts")
        const posts = await (this.self.commitLog.find({

        }, {
            // sort: {
                
            // }
        }).toArray())
        console.log(posts)
    }

    async start() {
        this.self.lockService.registerHandle('post-sync', () => {
            console.log('registered post-sync')
            NodeSchedule.scheduleJob('* * * * *', this.syncPosts)
        })
    }
}