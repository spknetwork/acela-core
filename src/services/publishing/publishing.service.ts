import { Injectable, Logger } from '@nestjs/common';

import { VideoToPublishDto } from './dto/video-to-publish.dto';
import { APP_BUNNY_IPFS_CDN, APP_IMAGE_CDN_DOMAIN } from '../../consts';
import {
  PostBeneficiary,
  CommentOption,
  HiveAccountMetadata,
  CustomJsonOperation,
  OperationsArray,
} from '../../repositories/hive-chain/types';
import { VideoRepository } from '../../repositories/video/video.repository';
import { CreatorRepository } from '../../repositories/creator/creator.repository';
import { HiveRepository } from '../../repositories/hive-chain/hive-chain.repository';
import 'dotenv/config';
import { Video } from '../../repositories/video/schemas/video.schema';

const videoPostTemplate = `<center>

[![](@@@thumbnail@@@)](https://3speak.tv/watch?v=@@@author@@@/@@@permlink@@@)

▶️ [Watch on 3Speak](https://3speak.tv/watch?v=@@@author@@@/@@@permlink@@@)

</center>

---

@@@description@@@

---

▶️ [3Speak](https://3speak.tv/watch?v=@@@author@@@/@@@permlink@@@)`;

@Injectable()
export class PublishingService {
  readonly #logger: Logger;
  readonly #videoRepository: VideoRepository;
  readonly #creatorRepository: CreatorRepository;
  readonly #hiveRepository: HiveRepository;

  constructor(
    videoRepository: VideoRepository,
    creatorRepository: CreatorRepository,
    hiveRepository: HiveRepository,
  ) {
    this.#videoRepository = videoRepository;
    this.#creatorRepository = creatorRepository;
    this.#hiveRepository = hiveRepository;
    this.#logger = new Logger(PublishingService.name);
  }

  async normalVideoPublish() {
    const videosToPublish = await this.#videoRepository.getVideosToPublish();
    for (const video of videosToPublish) {
      await this.publish(video);
    }
  }

  async publish(video: Video): Promise<void> {
    try {
      if (
        await this.#hiveRepository.hivePostExists({ author: video.owner, permlink: video.permlink })
      ) {
        await this.#videoRepository.setPostedToChain(video.owner, video.ipfs);
        this.#logger.warn(`## SKIPPED ${video.owner}/${video.permlink} ALREADY PUBLISHED!`);
        return;
      }

      if (!video.size) {
        this.#logger.error(
          'Videos are not being populated with a size field at time of publishing!',
        );
        return;
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
        fromMobile: video.fromMobile || false,
        beneficiaries: video.beneficiaries,
        declineRewards: video.declineRewards,
        rewardPowerup: video.rewardPowerup,
      });

      if (publish && publish.id) {
        await this.#videoRepository.setPostedToChain(video.owner, video.hive);

        await this.#creatorRepository.setUserToVisible(video.owner);

        this.#logger.log(
          '## Published:',
          'https://hiveblockexplorer.com/tx/' + publish.id,
          'https://3speak.tv/watch?v=' + video.owner + '/' + video.permlink,
        );
      } else {
        const lowRc = !!publish.message && publish.message.indexOf('power up') > -1;
        const blockSizeExceeded =
          !!publish.message && publish.message.indexOf('maximum_block_size') > -1;
        const missingAuthority =
          !!publish.message && publish.message.indexOf('Missing Posting Authority') > -1;
        const titleException =
          !!publish.message && publish.message.indexOf('Title size limit exceeded.') > -1;
        const paidForbidden =
          !!publish.message &&
          publish.message.indexOf('Updating parameters for comment that is paid out is forbidden') >
            -1;
        const commentBeneficiaries =
          !!publish.message &&
          publish.message.indexOf('Comment already has beneficiaries specified') > -1;
        const publishFailed =
          blockSizeExceeded ||
          missingAuthority ||
          titleException ||
          paidForbidden ||
          commentBeneficiaries;

        await this.#videoRepository.updateVideoFailureStatus(video.owner, { lowRc, publishFailed });

        this.#logger.warn(
          '## ERROR, failed to publish:',
          publish.message,
          `${video.owner}/${video.permlink}`,
          { blockSizeExceeded, missingAuthority },
        );
      }
    } catch (ex) {
      this.#logger.error(ex);
    }
  }

  async #publishVideoToChain(detail: VideoToPublishDto) {
    const operations = await this.#formatOperations(detail, true);

    return await this.#hiveRepository.broadcastOperations(operations);
  }

  async #formatOperations(detail: VideoToPublishDto, comment_options: boolean) {
    const operations: OperationsArray = [];

    operations.push([
      'comment',
      {
        parent_author: '',
        parent_permlink:
          detail.community === null || detail.community === '' || detail.community === 'hive-100421'
            ? 'hive-181335'
            : detail.community.startsWith('hive-')
              ? detail.community
              : 'hive-181335',
        author: detail.author,
        permlink: detail.permlink,
        title: detail.title.substr(0, 254),
        body: this.#renderTemplate(detail),
        json_metadata: JSON.stringify(this.#buildJSONMetadata(detail, 'video')),
      },
    ]);

    if (comment_options) {
      operations.push(await this.#buildCommentOptions(detail));
    }
    operations.push(this.#buildPublishCustomJson(detail));

    if (detail.postToHiveBlog == true) {
      operations.push([
        'custom_json',
        {
          required_auths: [],
          required_posting_auths: [detail.author],
          id: 'reblog',
          json: JSON.stringify([
            'reblog',
            {
              account: detail.author,
              author: detail.author,
              permlink: detail.permlink,
            },
          ]),
        },
      ]);
    }

    return operations;
  }

  #buildJSONMetadata(detail: VideoToPublishDto, postType: 'video' | 'blog') {
    const imageUrl = detail?.thumbnail?.includes('ipfs://')
      ? `${APP_BUNNY_IPFS_CDN}/ipfs/${detail.thumbnail.replace('ipfs://', '')}`
      : `${APP_IMAGE_CDN_DOMAIN}/${detail.permlink}/thumbnails/default.png`;

    const sourceMap = detail.video_v2
      ? [
          {
            type: 'video',
            url: detail.video_v2,
            format: 'm3u8',
          },
        ]
      : [];

    const tags = this.#processTags(detail.tags);

    return {
      tags,
      app: '3speak/0.4.0',
      type: `3speak/${postType}`,
      image: [imageUrl],
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
            },
          ],
        },
        content: {
          description: detail.description,
          tags,
        },
      },
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
      tagsString
        .split(',')
        .map((tag) =>
          tag
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, ''),
        )
        .filter((tag) => tag && !tag.startsWith('hive-') && tag.length >= 3),
    );

    return processed.size > 0 ? Array.from(processed) : fallback;
  }

  async #buildCommentOptions(detail: VideoToPublishDto): Promise<CommentOption> {
    const benefactor_global: [[number, { beneficiaries: PostBeneficiary[] }]] = [
      [0, { beneficiaries: [{ account: 'threespeakleader', weight: 100 }] }],
    ];

    // Fetch hive account and parse json_metadata
    const hiveAccount = await this.#hiveRepository.getAccount(detail.author);
    if (hiveAccount?.json_metadata) {
      const json: HiveAccountMetadata = JSON.parse(hiveAccount.json_metadata);
      json.beneficiaries?.forEach((bene) => {
        if (
          bene.name !== 'spk.delegation' &&
          ['referrer', 'provider', 'creator'].includes(bene.label)
        ) {
          benefactor_global[0][1].beneficiaries.push({
            account: bene.name,
            weight: bene.weight,
          });
        }
      });
    }

    // Process video beneficiaries
    const videoBenefs: PostBeneficiary[] = detail.beneficiaries
      ? JSON.parse(detail.beneficiaries)
      : [];
    if (detail.fromMobile) {
      const sagarExists = videoBenefs.some(
        (ben) =>
          ben.account === 'sagarkothari88' &&
          ['MOBILE_APP_PAY', 'MOBILE_APP_PAY_AND_ENCODER_PAY'].includes(ben.src || ''),
      );
      if (!sagarExists) {
        videoBenefs.push({ account: 'sagarkothari88', weight: 100, src: 'MOBILE_APP_PAY' });
      }
    }

    // Deduplicate beneficiaries
    const uniqueBeneficiaries = new Map(videoBenefs.map((bene) => [bene.account, bene]));
    const finalBeneficiaries = Array.from(uniqueBeneficiaries.values()).filter(
      (bene) => !['wehmoen', 'louis88', 'detlev'].includes(bene.account),
    );

    benefactor_global[0][1].beneficiaries = [
      ...benefactor_global[0][1].beneficiaries,
      ...finalBeneficiaries,
    ];

    if (detail.upload_type === 'ipfs') {
      benefactor_global[0][1].beneficiaries.push({ account: 'spk.beneficiary', weight: 900 });
    } else {
      benefactor_global[0][1].beneficiaries.push({ account: 'spk.beneficiary', weight: 1000 });
    }

    return [
      'comment_options',
      {
        author: detail.author,
        permlink: detail.permlink,
        max_accepted_payout: detail.declineRewards ? '0.000 SBD' : '100000.000 SBD',
        percent_hbd: detail.rewardPowerup ? 0 : 10000,
        allow_votes: true,
        allow_curation_rewards: true,
        extensions: detail.declineRewards ? [] : benefactor_global,
      },
    ];
  }

  #renderTemplate(detail: VideoToPublishDto) {
    const [fullVideo] = this.#getbaseThumbnail([detail]);

    return videoPostTemplate
      .replace(/@@@thumbnail@@@/g, fullVideo ? fullVideo.baseThumbUrl : '')
      .replace(/@@@author@@@/g, detail.author)
      .replace(/@@@permlink@@@/g, detail.permlink)
      .replace(/@@@description@@@/g, detail.description);
  }

  #replaceIpfsWithCdn(url) {
    return url.replace('ipfs://', `${APP_BUNNY_IPFS_CDN}/ipfs/`);
  }

  #getbaseThumbnail(videoFeed: VideoToPublishDto[]): { baseThumbUrl: string }[] {
    return videoFeed.map((video) => {
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
    return [
      'custom_json',
      {
        required_posting_auths: [process.env.DELEGATED_ACCOUNT || 'threespeak', detail.author],
        required_auths: [],
        id: '3speak-publish',
        json: JSON.stringify({
          author: detail.author,
          permlink: detail.permlink,
          category: detail.category,
          language: detail.language,
          duration: detail.duration,
          title: detail.title,
        }),
      },
    ];
  }
}
