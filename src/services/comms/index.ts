import NodeSchedule from 'node-schedule'
import Slug from 'slug'
import { AcelaCore } from "..";
import { buildJSONMetadata, renderTemplate } from './utils';





export class CommsCore {
    self: AcelaCore;
    constructor(self: AcelaCore) {
        this.self = self;

        this.syncPosts = this.syncPosts.bind(this)
    }


    async getMedia(post: any, videoType: string) {
        const upload = await this.self.uploadsDb.findOne({
            id: post.upload_links[videoType]
        })
        if(!upload) {
            return null;
        }
        if(videoType === "video") {
            const encode_cid = upload.encode_cid
            if(encode_cid) {
                return `ipfs://${encode_cid}/manifest.m3u8`
            }
        } else if(videoType === "thumbnail") {
            if(upload.cid) {
                return `ipfs://${upload.cid}`
            }
        } else {
            return null;
        }
        return null;
    }

    async syncPosts() {
        console.log("Syncing Posts")
        const localPosts = await this.self.localPosts.find().toArray()

        // console.log(localPosts)
        for(let post of localPosts) {
            const mediaThumbnailUrl = await this.getMedia(post, 'thumbnail')
            const mediaVideUrl = await this.getMedia(post, 'video')

            if(post.title) {
                console.log({
                    slug: `${Slug(post.title)}-${new Date().getTime()}z`
                })
            }

            const permlink = `${Slug(post.title)}-${new Date().getTime()}z`;
            
            const metadata = buildJSONMetadata({
                ...post,
                permlink,
                thumbnail: mediaThumbnailUrl,
                video: mediaVideUrl
            })
            console.log(JSON.stringify(metadata, null, 2))

            const renderedDescription = renderTemplate({
                ...post,
                permlink,
                thumbnail: mediaThumbnailUrl,
                video: mediaVideUrl
            })
            console.log(renderedDescription)
            // console.log(mediaUrl)
            // console.log(mediaUrl2)
        }
        // const posts = await (this.self.commitLog.find({

        // }, {
        //     // sort: {
                
        //     // }
        // }).toArray())
        // console.log(posts)
    }

    async start() {
        await this.syncPosts()
        this.self.lockService.registerHandle('post-sync', () => {
            console.log('registered post-sync')
            NodeSchedule.scheduleJob('* * * * *', this.syncPosts)
        })
    }
}