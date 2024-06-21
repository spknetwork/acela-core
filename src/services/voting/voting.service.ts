import { Injectable, Logger } from '@nestjs/common';
import { VideoRepository } from '../../repositories/video/video.repository';
import { CreatorRepository } from '../../repositories/creator/creator.repository';
import { HiveRepository } from '../../repositories/hive-chain/hive-chain.repository';
import moment from 'moment';
import { ExtendedAccount, VoteOperation } from '@hiveio/dhive';
import { VideoMap } from './types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VotingService {
  readonly #logger: Logger;
  readonly #videoRepository: VideoRepository;
  readonly #creatorRepository: CreatorRepository;
  readonly #hiveRepository: HiveRepository;
  readonly #configService: ConfigService;

  constructor(
    videoRepository: VideoRepository,
    creatorRepository: CreatorRepository,
    hiveRepository: HiveRepository,
    configService: ConfigService,
  ) {
    this.#videoRepository = videoRepository;
    this.#creatorRepository = creatorRepository;
    this.#hiveRepository = hiveRepository;
    this.#configService = configService;
    this.#logger = new Logger(VotingService.name);
  }

  async distributeVotes(hoursBetween: number) {
    const bannedList = await this.#creatorRepository.getBannedList();

    const startPeriod = new Date(new Date().setHours(new Date().getHours() - 23));
    const endPeriod = new Date(new Date().setHours(new Date().getHours() - 20));

    const videos = await this.#videoRepository.getUpvoteEligibleVideosInTimePeriod(
      bannedList,
      startPeriod,
      endPeriod,
    );

    if (!videos.length) return;

    let totalViews = 0;
    const videoMap: VideoMap = videos.reduce((acc, vid) => {
      if (!acc[vid.owner]) {
        acc[vid.owner] = { views: 0, share: 0, videos: {} };
      }
      return acc;
    }, {});

    for (const video of videos) {
      const owner = video.owner;
      let views = video.views;
      const perm = video.permlink;
      const reduced = video.reducedUpvote;
      views = await this.#getRelativeViews(owner, perm, views, reduced);
      this.#logger.log(video.created);
      this.#logger.log(owner, views);
      totalViews += views;
      videoMap[owner].views += views;
      videoMap[owner].reduced = reduced;
      videoMap[owner].videos[perm] = views;
    }

    const threespeak = await this.#hiveRepository.getAccount('threespeak');
    const vp = this.#calculateVotingMana(threespeak);

    const factor = ((vp - 80) * 5) / 100;

    if (factor <= 0) return;

    const operations = await this.#constructOperations(videoMap, totalViews, factor, hoursBetween);

    this.#logger.log(operations);

    for (const operation of operations) {
      try {
        await this.#vote(operation);
      } catch (e) {
        this.#logger.error(`Error when voting ${operation.author}/${operation.permlink}`);
      }
    }
  }

  async #constructOperations(
    videoMap: VideoMap,
    totalViews: number,
    factor: number,
    hoursBetween: number,
  ): Promise<VoteOperation[1][]> {
    const operations: VoteOperation[1][] = [];

    for (const creator in videoMap) {
      const contentCreator = videoMap[creator];
      //share is the weight of the upvotes being given out relative to views, hours between cycles and
      //how much voting power the account has left in it
      contentCreator.share = Math.round(
        (contentCreator.views / totalViews) * 10000 * factor * (hoursBetween / 2),
      );
      if (contentCreator.share > 10000) {
        contentCreator.share = 10000;
      }
      if (contentCreator.share > 3000 && contentCreator.reduced) {
        contentCreator.share = 3000;
      }
      //find most popular video
      //don't perform downvotes
      let perm = '';
      let highest = 0;
      for (const video in contentCreator.videos) {
        const videoViews = contentCreator.videos[video];
        if (videoViews > highest) {
          highest = videoViews;
          perm = video;
        }
      }
      if (contentCreator.share > 0) {
        operations.push({
          author: creator,
          permlink: perm,
          weight: Math.round(contentCreator.share),
          voter: 'threespeak',
        });
      }
    }
    return operations;
  }

  async #getRelativeViews(author: string, permlink: string, views: number, reduced: boolean) {
    // get post data from
    let commentCount;

    try {
      commentCount = await this.#hiveRepository.getCommentCount({ author, permlink });
    } catch (e) {
      commentCount = 6;
    }

    //let res = await hiveClient.database.call('get_content', [owner, permlink])
    if (!commentCount) {
      commentCount = 6;
    }
    if (reduced) {
      views *= 0.3;
    }
    // if more than or equal to 5 comments, post gets full payout
    if (views < 5) {
      return 0;
    } else if (commentCount >= 5) {
      return views;
    } else if (commentCount <= 2) {
      return 0;
    } // less than 5 comments means views are essentially halved for this video
    return views / 2;
  }

  #calculateVotingMana(account: ExtendedAccount): number {
    const elapsed = moment.utc().unix() - account.voting_manabar.last_update_time;
    const maxMana = this.#getEffectiveVestingShares(account) * 1000000;
    let currentMana =
      parseFloat(`${account.voting_manabar.current_mana}`) + (elapsed * maxMana) / 432000;

    if (currentMana > maxMana) {
      currentMana = maxMana;
    }

    return (currentMana / maxMana) * 100;
  }

  #getEffectiveVestingShares(account: ExtendedAccount): number {
    return (
      parseFloat(account.vesting_shares.toString()) +
      parseFloat(account.received_vesting_shares.toString()) -
      parseFloat(account.delegated_vesting_shares.toString())
    );
  }

  async #vote(op: VoteOperation[1]): Promise<void> {
    const votes = await this.#hiveRepository.getActiveVotes({
      author: op.author,
      permlink: op.permlink,
    });

    const voter = this.#configService.get<string>('DELEGATED_ACCOUNT');

    if (!voter) {
      throw new Error('Voter account not set');
    }

    // check if @threespeak has already voted
    const voted = votes.some((vote) => vote.voter === voter);

    if (voted) {
      // Don't perform another vote operation, go to next as votes have already been cast
      return;
    }

    op.voter = voter;
    await this.#hiveRepository.vote(op);

    return;
  }
}
