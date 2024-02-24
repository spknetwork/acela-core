import { createProjectionFromDto } from "../../../utils/createProjectionFromDto";

export class VideoToPublishDto {
  readonly author: string;
  readonly permlink: string;
  readonly title: string;
  readonly community: string;
  readonly description: string;
  readonly upload_type?: string;
  readonly thumbnail?: string;
  readonly video_v2?: string;
  readonly tags?: string;
  readonly duration?: number;
  readonly size: number;
  readonly filename: string;
  readonly language?: string;
  readonly firstUpload: boolean;
  readonly ipfs?: string;
  readonly category?: string;
  readonly fromMobile: boolean;
  readonly beneficiaries: string;
  readonly declineRewards: boolean;
  readonly rewardPowerup: boolean;
  readonly postToHiveBlog?: boolean;
}

export const videosToPublishProjection = createProjectionFromDto(VideoToPublishDto)