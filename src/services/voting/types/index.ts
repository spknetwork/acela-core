export interface VideoMap {
  [key: string]: {
    views: number;
    share: number;
    reduced?: boolean;
    videos: {
      [key: string]: number;
    };
  };
}
