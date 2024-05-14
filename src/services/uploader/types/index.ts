export type Upload = {
  authorization: string;
  Storage: { Path: string } | undefined;
  Size: number;
  ID: string;
  MetaData: {
    authorization: string;
    Storage: any;
    Size: number;
    ID: string;
    upload_id: string;
    video_id: string;
  };
};
