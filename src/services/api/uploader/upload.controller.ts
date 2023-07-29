import {
  UseGuards,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
  Request,
  Body,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common'
import { FileInterceptor, MulterModule } from '@nestjs/platform-express'
import { AuthGuard } from '@nestjs/passport'
import moment from 'moment'
import {v4 as uuid, v5 as uuidv5} from 'uuid'
import { appContainer } from '..'
import { RequireHiveVerify, UserDetailsInterceptor } from '../utils'
import { ipfsCluster } from '../../storage-engine'
import { ApiConsumes, ApiOperation, ApiProperty } from '@nestjs/swagger'

class CreateUploadDto {
  @ApiProperty({
    description: 'Title of the post',
    default: "Your video title",
  })
  title: string

  @ApiProperty({
    description: 'Description of the post',
    default: "This video is a test video. Here we can put a description",
  })
  body: string

  @ApiProperty({
    description: 'Tags for the post',
    default: ['threespeak', 'acela-core'],
  })
  tags: string[]

  @ApiProperty({
    description: 'Community',
    default: 'hive-101',
  })
  community: string

  @ApiProperty({
    description: 'Language of the video in ISO 639-1 format',
    default: 'en',
  })
  language: string
}

class StartEncodeDto {
  @ApiProperty({
    description: 'ID of the upload',
    default: 'ec102517-7be9-4255-9d07-75a525a88565',
  })
  upload_id: string
}

class UploadThumbnailUpload {

  @ApiProperty({
    description: "ID of video"
  })
  video_id: string
  @ApiProperty({
    description: 'Attachments',
    type: 'array',
    items: {
      type: 'file',
      items: {
        type: 'string',
        format: 'binary',
      },
    },
  })
  file: any
}


MulterModule.registerAsync({
  useFactory: () => ({
    dest: process.env.UPLOAD_PATH || './upload',
  }),
});

@Controller('/api/v1')
export class UploadController {

  @ApiConsumes('multipart/form-data', 'application/json')
  @Post('upload_thumbnail')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(
    @Req() req, 
    @Body() Body: UploadThumbnailUpload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10_000_000 }),
          new FileTypeValidator({ fileType: 'image/' }),
        ],
      }),
    )
    file: any,
  ) {
    const {body, user} = req;
    
    // console.log(body)

    /**
     * TODO: do a bit more verification of user authority
     */

    const id = uuidv5(`thumbnail`, body.video_id)

    console.log('uploaded thumbnail', file)
    const { cid } = await ipfsCluster.addData(file.buffer, {
      metadata: {
        key: `${body.video_id}/thumbnail`,
        app: "3speak-beta",
        message: "acela beta please ignore"
      },
      replicationFactorMin: 1,
      replicationFactorMax: 2,
    })
    // console.log(cid)

    await appContainer.self.uploadsDb.findOneAndUpdate({
      id: id
    }, {
      $set: {
        video_id: body.video_id,
        expires: null,
        file_name: null,
        file_path: null,
        ipfs_status: 'done',
        cid,
        type: 'thumbnail'
      }
    }, {
      upsert: true
    });


    await appContainer.self.localPosts.findOneAndUpdate({
      id: body.video_id
    }, {
      $set: {
        "upload_links.thumbnail": id, 
      }
    })
    
    console.log('uploadedFile', file.path)
    console.log('uploadedFile', file)

    return {
      status: 'ok',
      thumbnail_cid: cid
    }
  }

  //Sequence matters
  @ApiOperation({ summary: 'Creates post metadata container' })
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @UseInterceptors(UserDetailsInterceptor)
  @Post('create_upload')
  async createUpload(@Request() req, @Body() reqBody: CreateUploadDto) {
    const body = reqBody
    const user = req.user

    // console.log(body, req.headers, req.user)
    const id = uuid();
    const upload_id = uuid();

    const localPost = await appContainer.self.localPosts.insertOne({
      id,
      owner: user.username,
      title: body.title,
      description: body.body,
      beneficiaries: [],
      tags: body.tags || [],
      community: body.community, //'',
      language: body.language || 'en', //'en',

      //For videos only
      video_details: {
        duration: 0,
      },

      posting_options: {
        publish_type: "immediate",// | "scheduled",
        publish_date: null
      },

      status: "created",
      created_by: user.sub,
      created_at: new Date(),
      updated_at: new Date(),
      expires: moment().add('1', 'day').toDate(),

      upload_links: {
        video: id
      },
      network: "hive",
      
      __flags: [],
      __v: '0.1'
    })

    // console.log(localPost)


    await appContainer.self.uploadsDb.insertOne({
      id,
      expires: moment().add('1', 'day').toDate(),
      created_by: req.user.sub
    })

    return {
      id,
      upload_id
    }
    // console.log(body, appContainer.self.uploadsDb, req.user)
  }
  @UseGuards(AuthGuard('jwt'))
  @Post('start_encode')
  async startEncode(@Body() body: StartEncodeDto) {
    const uploadJob = await appContainer.self.uploadsDb.findOne({
      id: body.upload_id
    })
    if(uploadJob) {
      await appContainer.self.uploadsDb.findOneAndUpdate({
        _id: uploadJob._id
      }, {
        $set: {
          // encode_status: "ready"
          ipfs_status: "ready"
        }
      })
    }
    // console.log(body)
    // console.log('uploadJob', uploadJob)
    return {
      // id
    }
  }


  @ApiOperation({ summary: 'Updates the metadata of a pending upload [Work in progress]' })
  @Post('update_post')
  async postUpdate(@Body() body, @Req() req) {
    console.log(req)
    
    const uploadedInfo = await appContainer.self.uploadsDb.findOne({
      id: body.id
    })

    if(uploadedInfo.created_by === body.id) {
      const updatedInfo = await appContainer.self.uploadsDb.findOneAndUpdate({
        id: body.id
      }, {
        $set: {
          // file_path: body.Upload.Storage.Path,
          // file_name: body.Upload.ID
        }
      })

      // console.log(uploadedInfo)
      
    } else {
      throw new HttpException({ reason: "You do not have access to edit the requested post"}, HttpStatus.BAD_REQUEST)
    }
  }

  @Post('tus-callback')
  @ApiOperation({ summary: 'TUSd uploader callback. Internal use only' })
  async tusdCallback(@Body() body) {
    if(body.Upload.MetaData.authorization === "TESTING") {
      throw new HttpException({ error: 'Test authorization used' }, HttpStatus.BAD_REQUEST)
    }
    if(body.Upload.Storage) {
      await appContainer.self.uploadsDb.findOneAndUpdate({
        id: body.Upload.MetaData.upload_id
      }, {
        $set: {
          file_path: body.Upload.Storage.Path,
          file_name: body.Upload.ID
        }
      })
    }
    // console.log(req)
  }
}
