export class CreateVideoDto {
  readonly filename: string;
  readonly userId: string;
  readonly firstUpload: boolean;
  readonly originalFilename: string;
  readonly permlink: string;
  readonly duration: string;
  readonly size: number;
  readonly owner: string;
  readonly created: Date;
  readonly upload_type: string;
}