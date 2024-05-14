export class UploadDto {
  readonly upload_id: string;
  readonly video_id: string;
  readonly expires?: Date;
  readonly file_name?: string;
  readonly file_path?: string;
  readonly ipfs_status: 'pending' | 'done' | 'error';
  readonly cid?: string;
  readonly type: 'video' | 'thumbnail' | 'other';
  readonly created_by: string;
  readonly immediatePublish: boolean;
}
