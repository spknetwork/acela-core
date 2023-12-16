export interface HiveAccount {
  json_metadata: string;
  name: string;
}

export type CommentOption = [
  'comment_options',
  {
    author: string;
    permlink: string;
    max_accepted_payout: string;
    percent_hbd: number;
    allow_votes: boolean;
    allow_curation_rewards: boolean;
    extensions: any[];
  }
];

export interface PostBeneficiary {
  account: string;
  weight: number;
  src?: string;
}

export interface AccountBeneficiary {
  name: string;
  label: string;
  weight: number;
}

export interface HiveAccountMetadata {
  beneficiaries?: AccountBeneficiary[];
}

export type PostOperation = (string | {
  parent_author: string;
  parent_permlink: string;
  author: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: string;
})[];

export type CustomJsonOperation = (string | {
  required_posting_auths: string[];
  required_auths: never[];
  id: string;
  json: string;
})[];

export type OperationsArray = (PostOperation | CustomJsonOperation | CommentOption)[];