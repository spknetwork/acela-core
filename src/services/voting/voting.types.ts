export interface VideoMap {
  [key: string]: {
    comments: number;
    share: number;
    reduced?: boolean;
    videos: {
      [key: string]: number;
    };
  };
}
