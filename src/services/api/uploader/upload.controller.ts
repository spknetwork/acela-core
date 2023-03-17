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
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '@nestjs/passport'
import moment from 'moment'
import {v4 as uuid, v5 as uuidv5} from 'uuid'
import { appContainer } from '..'
import { RequireHiveVerify, UserDetailsInterceptor } from '../utils'
import { ipfsCluster } from '../../storage-engine'

@Controller('/api/v1')
export class UploadController {
  @Post('upload_thumbnail')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(
    @Req() req, 
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10_000_000 }),
          new FileTypeValidator({ fileType: 'image/' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const {body, user} = req;
    
    // console.log(body)

    /**
     * TODO: do a bit more verification of user authority
     */

    const id = uuidv5(`thumbnail`, body.video_id)

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
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @UseInterceptors(UserDetailsInterceptor)
  @Post('create_upload')
  async createUpload(@Request() req) {
    const body = req.body
    const user = req.user

    // console.log(body, req.headers, req.user)
    const id = uuid();
    const upload_id = uuid();

    const localPost = await appContainer.self.localPosts.insertOne({
      id,
      owner: user.username,
      title: body.title,
      description: body.description,
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
  async startEncode(@Body() body) {
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
