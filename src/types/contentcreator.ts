import { ObjectId } from 'mongodb'

export interface ContentCreator {
  username: string
  network: string
  banned: boolean
  ban_reason?: string
  can_upload?: boolean
  hidden?: boolean
  joined?: boolean
  score?: number
  post_warning?: boolean
  ask_witness_vote?: boolean
  warning_pending?: boolean
  warning?: string
  upvote_eligible?: boolean
  reducedUpvote?: boolean
}
