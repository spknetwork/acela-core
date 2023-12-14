import { createProjectionFromDto } from "../../../../utils/createProjectionFromDto";

export class TrendingChainDto {
  readonly created: Date;
  readonly language?: string;
  readonly views: number;
  readonly owner: string;
  readonly permlink: string;
  readonly title: string;
  readonly duration?: number;
  readonly tags?: string;
}

export const trendingChainProjection = createProjectionFromDto(TrendingChainDto)