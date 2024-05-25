// src/ipfs/ipfs.interfaces.ts

export interface IpfsPinOptions {
  name?: string;
  mode?: string;
  replicationFactorMin?: number;
  replicationFactorMax?: number;
  shardSize?: number;
  userAllocations?: string[];
  expireAt?: Date;
  pinUpdate?: string;
  origins?: string[];
  metadata?: Record<string, string>;
}

export interface IpfsAddOptions extends IpfsPinOptions {
  local?: boolean;
  recursive?: boolean;
  hidden?: boolean;
  wrap?: boolean;
  shard?: boolean;
  streamChannels?: boolean;
  format?: string;
  layout?: string;
  chunker?: string;
  rawLeaves?: boolean;
  progress?: Function;
  cidVersion?: number;
  hashFun?: string;
  noCopy?: boolean;
}

export interface IpfsFile {
  filename: string;
  content: Buffer;
}

export interface IpfsAddResult {
  cid: string;
  path: string;
}

export interface IIpfsService {
  encodePinOptions(options: IpfsPinOptions): Record<string, any>;
  encodeMetadata(metadata: Record<string, string>): Record<string, string>;
  encodeParams<T>(options: T): { [K: string]: T };
  encodeAddParams(options: IpfsAddOptions): Record<string, any>;
  addData(cluster: string, file: IpfsFile, options: IpfsAddOptions): Promise<IpfsAddResult>;
}
