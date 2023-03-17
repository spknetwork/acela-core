import { binary_to_base58 } from 'base58-js'
import Slug from 'slug'
import { HiveClient } from '../../utils'

const POST_TEMPLATE = `
<center>

[![](@@@thumbnail@@@)](https://3speak.tv/watch?v=@@@author@@@/@@@permlink@@@)

▶️ [Watch on 3Speak](https://3speak.tv/watch?v=@@@author@@@/@@@permlink@@@)

</center>

---

@@@description@@@

---

▶️ [3Speak](https://3speak.tv/watch?v=@@@author@@@/@@@permlink@@@)
`


const APP_VIDEO_CDN_DOMAIN = 'https://threespeakvideo.b-cdn.net'
const APP_AUDIO_CDN_DOMAIN = 'https://audio.cdn.3speakcontent.co'
const APP_HIVE_CDN_DOMAIN = 'https://hive.cdn.3speakcontent.co'
const APP_IMAGE_CDN_DOMAIN = 'https://media.3speak.tv'
const APP_BUNNY_IPFS_CDN = 'https://ipfs-3speak.b-cdn.net'


function processFeed(videoFeed) {
  const bugFix = JSON.parse(JSON.stringify(videoFeed))
  let out = []
  for (let video of bugFix) {
    let baseUrl
    let playUrl
    if (video.upload_type === 'ipfs') {
      baseUrl = `${APP_BUNNY_IPFS_CDN}/ipfs/${video.thumbnail.replace('ipfs://', '')}/`
      playUrl = `${APP_BUNNY_IPFS_CDN}/ipfs/${video.video_v2.replace('ipfs://', '')}`
    } else {
      playUrl = `${APP_VIDEO_CDN_DOMAIN}/${video.permlink}/default.m3u8`
      if (video?.thumbnail?.includes('ipfs://')) {
        baseUrl = `${APP_BUNNY_IPFS_CDN}/ipfs/${video.thumbnail.replace('ipfs://', '')}/`
      } else {
        /*if(video.ipfs) {
            baseUrl = binary_to_base58(Buffer.from(`${APP_BUNNY_IPFS_CDN}/ipfs/${video.ipfs}/thumbnail.png`));
          } else {
          }*/
        baseUrl = `${APP_IMAGE_CDN_DOMAIN}/${video.permlink}/thumbnails/default.png`
      }
    }
    video.thumbUrl = `https://images.hive.blog/p/${binary_to_base58(
      Buffer.from(baseUrl),
    )}?format=jpeg&mode=cover&width=340&height=191`
    video.created = new Date(video.created)
    video.baseThumbUrl = baseUrl
    video.playUrl = playUrl
    out.push(video)
  }
  return out
}

function processTags(tags) {
    const fallback = ['threespeak', 'video'];
  
    const processed = [];
  
    for (let tag of tags) {
      tag = tag.toLowerCase().trim();
  
      if (!tag.startsWith('hive-') && tag.length >= 3) {
        tag = tag.replace(/[^a-z0-9]/g, '')
        if (!processed.includes(tag) && tag.length >= 3) {
          processed.push(tag)
        }
      }
    }
  
    return processed.length === 0 ? fallback : processed;
  }

export function buildJSONMetadata(video) {
  let tags = ['threespeak'].concat()

  let imageUrl
  if (video?.thumbnail?.includes('ipfs://')) {
    imageUrl = APP_BUNNY_IPFS_CDN + `/ipfs/${video.thumbnail.replace('ipfs://', '')}`
  }
  const sourceMap = []

  if (video.video) {
    sourceMap.push({
      type: 'video',
      url: video.video,
      format: 'm3u8',
    })
  }

  return {
    tags: processTags(video.tags),
    app: '3speak/0.4.0-beta1',
    type: '3speak/video',
    image: [imageUrl],
    video: {
      info: {
        platform: '3speak',
        title: video.title,
        author: video.owner,
        permlink: video.permlink,
        duration: video.duration,
        filesize: video.size,
        file: video.filename,
        lang: video.language,

        // Are these really needed?
        firstUpload: video.firstUpload,
        ipfs: video.ipfs ? video.ipfs + '/default.m3u8' : null,
        ipfsThumbnail: video.ipfs ? video.ipfs + '/thumbnail.png' : null,
        //
        
        video_v2: video.video,
        sourceMap: [
          ...sourceMap,
          {
            type: 'thumbnail',
            url: video.thumbnail,
          },
        ],
      },
      content: {
        description: video.description,
        tags: processTags(video.tags),
      },
    },
  }
}

export function renderTemplate(video) {
  const [fullVideo] = processFeed([video])
  console.log(fullVideo)

  return POST_TEMPLATE.replace(/@@@thumbnail@@@/g, fullVideo.baseThumbUrl)
    .replace(/@@@author@@@/g, video.owner)
    .replace(/@@@permlink@@@/g, video.permlink)
    .replace(/@@@description@@@/g, video.description)
}

export async function buildCommentOptions(video) {
    let benefactor_global = [
      [0, {beneficiaries: [{account: "threespeak.beta", weight: 100}, {account: 'spk.beneficiary', weight: 1000}]}]
    ];
    const [account] = await HiveClient.database.getAccounts([video.owner])

    // // let [account] = await hive.api.getAccountsAsync([video.owner]);
    // if (account && account.json_metadata) {
    //   let json = JSON.parse(account.json_metadata)
    //   if (json.beneficiaries) {
    //     if (Array.isArray(json.beneficiaries)) {
    //       let benefactors = json.beneficiaries.filter(x => x.name !== 'spk.delegation').filter(x => x.name && x.label)
    //       for (let bene of benefactors) {
    //         switch (bene.label) {
    //           case 'referrer':
    //             benefactor_global[0][1].beneficiaries.push({
    //               account: bene.name,
    //               weight: bene.weight
    //             })
    //             break;
    //           case 'provider':
    //             benefactor_global[0][1].beneficiaries.push({
    //               account: bene.name,
    //               weight: bene.weight
    //             })
    //             break;
    //           case 'creator':
    //             benefactor_global[0][1].beneficiaries.push({
    //               account: bene.name,
    //               weight: bene.weight
    //             })
    //             break;
    //         }
    //       }
    //     }
    //   }
    // }
  
    // benefactor_global[0][1].beneficiaries = benefactor_global[0][1].beneficiaries.concat(JSON.parse(video.beneficiaries))
  
    // benefactor_global[0][1].beneficiaries = benefactor_global[0][1].beneficiaries.filter((bene, index) => {
    //   const _bene = bene.account;
    //   return index === benefactor_global[0][1].beneficiaries.findIndex(obj => {
    //     return obj.account === _bene || ['wehmoen', 'louis88', 'detlev'].includes(obj.account);
    //   });
    // });
  
    // console.log(benefactor_global[0][1].beneficiaries)
  

    ;(benefactor_global[0][1] as any).beneficiaries = (benefactor_global[0][1] as any).beneficiaries.sort((b, a) => {
      return a.weight - b.weight
    }) 

    return ['comment_options', {
      author: video.owner,
      permlink: video.permlink,
      max_accepted_payout: video.declineRewards === true ? '0.000 SBD' : '100000.000 SBD',
      percent_hbd: video.rewardPowerup === true ? 0 : 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: benefactor_global//[] video.declineRewards ? [] //: benefactor_global
    }]
  }
  
export function buildPublishCustomJson(video) {
  return [
    'custom_json',
    {
      required_posting_auths: ['threespeak.beta', video.owner],
      required_auths: [],
      id: '3speak-publish',
      json: JSON.stringify({
        author: video.owner,
        permlink: video.permlink,
        language: video.language,
        duration: video.duration,
        title: video.title,
      }),
    },
  ]
}
