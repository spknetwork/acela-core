import { ObjectId } from 'mongodb'

export interface Beneficiary {
  account: string
  weight: number
  src: string
}

export interface VideoDetails {
  duration: number
  filename: string
  filesize: number
  original_filename: string
  thumbnail_url: string
}

export interface PublishingOptions {
  publish_type:  string //"immediate" // | "scheduled" | "manual"
  scheduled_date: null
}

export interface UploadLinks {
  video_id: string
}

export interface Video {
  owner: string
  title: string
  description: boolean
  beneficiaries: Array<Beneficiary>
  tags: Array<string>
  category: string
  community: string
  language: string //'en'
  video_details: VideoDetails
  publishing_options : PublishingOptions
  status: string // "created"
  created_by: string
  created_at: Date
  updated_at: Date
  expires: Date
  upload_links: UploadLinks
}
