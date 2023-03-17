import NodeSchedule from 'node-schedule'
import Slug from 'slug'
import { AcelaCore } from "..";
import * as DHive from '@hiveio/dhive'
import { HiveClient } from '../../utils';
import { buildCommentOptions, buildJSONMetadata, buildPublishCustomJson, renderTemplate } from './utils';





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
            console.log(upload)
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
        const localPosts = await this.self.localPosts.find({
            status: 'created'
        }).toArray()

        // console.log(localPosts)
        for(let post of localPosts) {
            try {

                const mediaThumbnailUrl = await this.getMedia(post, 'thumbnail')
                const mediaVideoUrl = await this.getMedia(post, 'video')
                console.log(post, mediaThumbnailUrl, mediaVideoUrl)
                if(!mediaVideoUrl || !mediaThumbnailUrl) {
                    continue;
                }
                
                // if(post.title) {
                //     console.log({
                //         slug: `${Slug(post.title)}-${new Date().getTime()}z`,
                //         mediaVideoUrl
                //     })
                // }
                
                const operations = []
    
                const permlink = `${Slug(post.title)}-${post.created_at.getTime()}z`;
                const video:any = {
                    ...post,
                    permlink,
                    thumbnail: mediaThumbnailUrl,
                    video: mediaVideoUrl
                };
    
                // const metadata = buildJSONMetadata(video)
                // console.log(JSON.stringify(metadata, null, 2))
    
                const renderedDescription = renderTemplate(video)
                // console.log(renderedDescription)
    
                const commentOptions = await buildCommentOptions(video)
                // console.log(JSON.stringify(commentOptions, null, 2))
                operations.push([
                    'comment', {
                      parent_author: '',
                      parent_permlink: video.community === null || video.community === '' || video.community === 'hive-100421' ? 'hive-181335' : video.community?.startsWith('hive-') ? video.community : 'hive-181335',
                      author: video.owner,
                      permlink: video.permlink,
                      title: video.title.substr(0, 254),
                      body: renderedDescription,
                      json_metadata: JSON.stringify(buildJSONMetadata(video))
                    }
                  ]);
                operations.push(commentOptions)
    
                const publishNotify = buildPublishCustomJson(video)
                operations.push(publishNotify)
                // console.log(operations)
                const tx = await HiveClient.broadcast.sendOperations(operations, DHive.PrivateKey.fromString(process.env.DELEGATED_ACCOUNT_POSTING))
                console.log(tx)
                await this.self.localPosts.findOneAndUpdate({
                    _id: post._id,
                }, {
                    $set: {
                        status: 'posted',
                        tx_id: tx.id
                    }
                })
                // console.log(mediaUrl)
                // console.log(mediaUrl2)
            } catch {

            }
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