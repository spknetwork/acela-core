import { createProjectionFromDto } from "../../../utils/createProjectionFromDto";

export class DbVideoToPublishDto {
  readonly owner: string;
  readonly permlink: string;
  readonly title: string;
  readonly hive: string;
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
}

export const dbVideoToPublishProjection = createProjectionFromDto(DbVideoToPublishDto)