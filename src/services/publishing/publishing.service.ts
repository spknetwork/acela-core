import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@hiveio/dhive';
import { HiveClient } from '../../utils/hiveClient';
import hiveJsPackage from '@hiveio/hive-js';
import { VideoToPublishDto } from './dto/video-to-publish.dto';
import { APP_BUNNY_IPFS_CDN, APP_IMAGE_CDN_DOMAIN } from '../../consts';
import { PostBeneficiary, CommentOption, HiveAccountMetadata, CustomJsonOperation, OperationsArray } from './types';
import { VideoRepository } from '../../repositories/video/video.service';
import { CreatorRepository } from '../../repositories/creator/creator.service';
import { chunk } from '../../utils/chunk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VideoPostTemplate = readFileSync(join(__dirname, 'templates/video.md'), 'utf-8');


hiveJsPackage.api.setOptions({
  useAppbaseApi: true,
  rebranded_api: true,
  url: `https://hive-api.web3telekom.xyz`
});
hiveJsPackage.config.set('rebranded_api','true');

@Injectable()
export class PublishingService {
  readonly #logger: Logger;
  readonly #videoService: VideoRepository;
  readonly #creatorService: CreatorRepository;
  readonly #hive: Client = HiveClient;
  readonly #hiveJs = hiveJsPackage

  constructor(videoService: VideoRepository, creatorService: CreatorRepository) {
    this.#videoService = videoService;
    this.#creatorService = creatorService;
    this.#logger = new Logger(PublishingService.name)
  }

  async normalVideoPublish() {
    const videosToPublish = await this.#videoService.getVideosToPublish();
    for (const video of videosToPublish) {

      try {
        if (await this.#hivePostExists({ author: video.owner, permlink: video.permlink })) {
          //await this.#videoService.setPostedToChain(video.owner, video.ipfs);
          this.#logger.warn(`## SKIPPED ${video.owner}/${video.permlink} ALREADY PUBLISHED!`);
          continue;
        }

        const publish = await this.#publishVideoToChain({
          author: video.owner,
          permlink: video.permlink,
          title: video.title,
          description: video.description,
          community: video.hive,
          size: video.size,
          filename: video.filename,
          firstUpload: video.firstUpload,
          fromMobile: video.fromMobile,
          beneficiaries: video.beneficiaries,
          declineRewards: video.declineRewards,
          rewardPowerup: video.rewardPowerup
        })

        if (publish && publish.id) {

          await this.#videoService.setPostedToChain(video.owner, video.hive);

          await this.#creatorService.setUserToVisible(video.owner);

          this.#logger.log('## Published:', 'https://hiveblockexplorer.com/tx/' + publish.id, 'https://3speak.tv/watch?v=' + video.owner + '/' + video.permlink)

        } else {
          const lowRc = !!publish.message && publish.message.indexOf('power up') > -1;
          const blockSizeExceeded = !!publish.message && publish.message.indexOf('maximum_block_size') > -1;
          const missingAuthority = !!publish.message && publish.message.indexOf('Missing Posting Authority') > -1;
          const titleException = !!publish.message && publish.message.indexOf('Title size limit exceeded.') > -1;
          const paidForbidden = !!publish.message && publish.message.indexOf('Updating parameters for comment that is paid out is forbidden') > -1;
          const commentBeneficiaries = !!publish.message && publish.message.indexOf('Comment already has beneficiaries specified') > -1;
          const publishFailed = blockSizeExceeded || missingAuthority || titleException || paidForbidden || commentBeneficiaries

          await this.#videoService.updateVideoFailureStatus(video.owner, { lowRc, publishFailed });

          this.#logger.warn(
            '## ERROR, failed to publish:',
            publish.message,
            `${video.owner}/${video.permlink}`,
            { blockSizeExceeded, missingAuthority }
          )
        }
      } catch (ex) {
        this.#logger.error(ex);
      }
    }
  }

  async publishTrendingMetadataOnChain() {
    const trendingForChain = await this.#videoService.getTrendingForChain()
    const chunks = chunk(trendingForChain, 10)
    const operations: CustomJsonOperation[] = chunks.map((chunk, index) => ([
      'custom_json', {
          required_posting_auths: [process.env.DELEGATED_ACCOUNT || 'threespeak'],
          required_auths: [],
          id: `3speak-trending-${index}`,
          json: JSON.stringify(chunk)
      }
    ]));
    try {
      const tx = await this._broadcastOperations(operations);
      this.#logger.log(`DONE: https://hiveblockexplorer.com/tx/${tx.id}`)
    } catch (e) {
      console.log(e.message)
    }
  }

  protected getLogger(): Logger {
    return this.#logger;
  }

  async _broadcastOperations(operations: OperationsArray) {
    return await this.#hiveJs.broadcast.sendAsync({
      operations
    }, {
      posting: process.env.DELEGATED_ACCOUNT_POSTING
    }).catch((e: any) => {
      this.#logger.error(`Error publishing operations to chain!`, operations, e)
      return e;
    });
  }

  async #hivePostExists({ author, permlink }: {author: string, permlink: string }) {
    try {
      const content = await this.#hiveJs.api.getContent(author, permlink);
  
      // Check if the content is an object and has a body. This implicitly checks for non-empty strings.
      return typeof content === "object" && !!content.body;
    } catch (e) {
      this.#logger.error("Error checking Steem post existence:", e);
      return false;
    }
  }

  async #publishVideoToChain(detail: VideoToPublishDto) {
    const operations = await this.#formatOperations(detail, true)

    return await this._broadcastOperations(operations)
  }

  async #formatOperations(detail: VideoToPublishDto, comment_options: boolean) {

    const operations: OperationsArray = [];
  
    operations.push([
      'comment', {
        parent_author: '',
        parent_permlink: detail.community === null || detail.community === '' || detail.community === 'hive-100421' ? 'hive-181335' : detail.community.startsWith('hive-') ? detail.community : 'hive-181335',
        author: detail.author,
        permlink: detail.permlink,
        title: detail.title.substr(0, 254),
        body: this.#renderTemplate(detail),
        json_metadata: JSON.stringify(this.#buildJSONMetadata(detail, 'video'))
      }
    ]);

    
  
    if (comment_options) {
      operations.push(await this.#buildCommentOptions(detail))
    }
    operations.push(this.#buildPublishCustomJson(detail))
  
    if (detail.postToHiveBlog == true) {
      operations.push([
        "custom_json",
        {
          "required_auths": [],
          "required_posting_auths": [detail.author],
          "id": "reblog",
          "json": JSON.stringify([
            "reblog", {
              "account": detail.author, 
              "author": detail.author,
              "permlink": detail.permlink
            }
          ])
        }
      ])
    }
  
  
    return operations;
  }

  #buildJSONMetadata(detail: VideoToPublishDto, postType: 'video' | 'blog') {
  
    const imageUrl = detail?.thumbnail?.includes('ipfs://')
    ? `${APP_BUNNY_IPFS_CDN}/ipfs/${detail.thumbnail.replace('ipfs://', '')}`
    : `${APP_IMAGE_CDN_DOMAIN}/${detail.permlink}/thumbnails/default.png`;
  
    const sourceMap = detail.video_v2 ? [{
      type: 'video',
      url: detail.video_v2,
      format: "m3u8"
    }] : [];

    let tags = this.#processTags(detail.tags)
  
    return {
      tags,
      app: '3speak/0.4.0',
      type: `3speak/${postType}`,
      image: [
        imageUrl
      ],
      video: {
        info: {
          platform: '3speak',
          title: detail.title,
          author: detail.author,
          permlink: detail.permlink,
          duration: detail.duration,
          filesize: detail.size,
          file: detail.filename,
          lang: detail.language,
          firstUpload: detail.firstUpload,
          ipfs: detail.ipfs ? detail.ipfs + '/default.m3u8' : null,
          ipfsThumbnail: detail.ipfs ? detail.ipfs + '/thumbnail.png' : null,
          video_v2: detail.video_v2,
          sourceMap: [
            ...sourceMap,
            {
              type: 'thumbnail',
              url: detail.thumbnail,
            }
          ]
        },
        content: {
          description: detail.description,
          tags
        }
      }
    };
  }

  #processTags(tagsString?: string): string[] {
    const fallback: string[] = ['threespeak', 'video'];
    
    // If tagsString is undefined or empty, return the fallback array.
    if (!tagsString?.trim()) {
      return fallback;
    }
  
    // Split the string into an array of tags and process them.
    const processed: Set<string> = new Set(
      tagsString.split(",")
                .map(tag => tag.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
                .filter(tag => tag && !tag.startsWith('hive-') && tag.length >= 3)
    );
  
    return processed.size > 0 ? Array.from(processed) : fallback;
  }

  async #buildCommentOptions(detail: VideoToPublishDto): Promise<CommentOption> {
    let benefactor_global: [[number, { beneficiaries: PostBeneficiary[] }]] = [
      [0, { beneficiaries: [{ account: "threespeakleader", weight: 100 }] }],
    ];

    // Fetch hive account and parse json_metadata
    const [hiveAccount] = await this.#hive.database.call('lookup_accounts',[detail.author, 1]);
    if (hiveAccount?.json_metadata) {
      let json: HiveAccountMetadata = JSON.parse(hiveAccount.json_metadata);
      json.beneficiaries?.forEach(bene => {
        if (bene.name !== 'spk.delegation' && ['referrer', 'provider', 'creator'].includes(bene.label)) {
          benefactor_global[0][1].beneficiaries.push({
            account: bene.name,
            weight: bene.weight
          });
        }
      });
    }

    // Process video beneficiaries
    let videoBenefs: PostBeneficiary[] = detail.beneficiaries ? JSON.parse(detail.beneficiaries) : [];
    if (detail.fromMobile) {
      const sagarExists = videoBenefs.some(ben => ben.account === 'sagarkothari88' && ['MOBILE_APP_PAY', 'MOBILE_APP_PAY_AND_ENCODER_PAY'].includes(ben.src || ''));
      if (!sagarExists) {
        videoBenefs.push({ account: 'sagarkothari88', weight: 100, src: 'MOBILE_APP_PAY' });
      }
    }

    // Deduplicate beneficiaries
    const uniqueBeneficiaries = new Map(videoBenefs.map(bene => [bene.account, bene]));
    const finalBeneficiaries = Array.from(uniqueBeneficiaries.values()).filter(bene => !['wehmoen', 'louis88', 'detlev'].includes(bene.account));

    benefactor_global[0][1].beneficiaries = [...benefactor_global[0][1].beneficiaries, ...finalBeneficiaries];


    if (detail.upload_type === "ipfs") {
      benefactor_global[0][1].beneficiaries.push({ account: 'spk.beneficiary', weight: 900 });
    } else {
      benefactor_global[0][1].beneficiaries.push({ account: 'spk.beneficiary', weight: 1000 });
    }


    return ['comment_options', {
      author: detail.author,
      permlink: detail.permlink,
      max_accepted_payout: detail.declineRewards ? '0.000 SBD' : '100000.000 SBD',
      percent_hbd: detail.rewardPowerup ? 0 : 10000,
      allow_votes: true,
      allow_curation_rewards: true,
      extensions: detail.declineRewards ? [] : benefactor_global
    }];
  }

  #renderTemplate(detail: VideoToPublishDto) {
    const [fullVideo] = this.#getbaseThumbnail([detail]);
    console.log(fullVideo)
  
    return VideoPostTemplate
      .replace(/@@@thumbnail@@@/g, fullVideo.baseThumbUrl)
      .replace(/@@@author@@@/g, detail.author)
      .replace(/@@@permlink@@@/g, detail.permlink)
      .replace(/@@@description@@@/g, detail.description);
  }

  #replaceIpfsWithCdn(url) {
    return url.replace('ipfs://', `${APP_BUNNY_IPFS_CDN}/ipfs/`);
  }

  #getbaseThumbnail(videoFeed: VideoToPublishDto[]) {
    return videoFeed.map(video => {
      const isIpfsUpload = video.upload_type === 'ipfs';
      const videoHasIpfsThumbnail = video?.thumbnail?.includes('ipfs://');

      const baseUrl = isIpfsUpload
        ? this.#replaceIpfsWithCdn(video.thumbnail)
        : videoHasIpfsThumbnail
        ? this.#replaceIpfsWithCdn(video.thumbnail)
        : `${APP_IMAGE_CDN_DOMAIN}/${video.permlink}/thumbnails/default.png`;

      return {
        baseThumbUrl: baseUrl,
      };
    });
  }

  #buildPublishCustomJson(detail: VideoToPublishDto): CustomJsonOperation {
    return ['custom_json', {
      required_posting_auths: ['threespeak', detail.author],
      required_auths: [],
      id: '3speak-publish',
      json: JSON.stringify({
        author: detail.author,
        permlink: detail.permlink,
        category: detail.category,
        language: detail.language,
        duration: detail.duration,
        title: detail.title
      })
    }]
  }
}
