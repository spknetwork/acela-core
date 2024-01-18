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
import * as IpfsClusterUtils from '../../utils/ipfsClusterUtils'
import { RequireHiveVerify, UserDetailsInterceptor } from '../api/utils'
import { ApiConsumes, ApiOperation, ApiProperty } from '@nestjs/swagger'
import { UploadThumbnailUploadDto } from './dto/upload-thumbnail.dto'
import { CreateUploadDto } from './dto/create-upload.dto'
import { StartEncodeDto } from './dto/start-encode.dto'
import { UploadRepository } from '../../repositories/upload/upload.repository'
import { ulid } from 'ulid'
import { VideoRepository } from '../../repositories/video/video.repository'
import { UploadingService } from './upload.service'

MulterModule.registerAsync({
  useFactory: () => ({
    dest: process.env.UPLOAD_PATH || './upload',
  }),
});

@Controller('/api/v1')
export class UploaderController {
  constructor(private readonly uploadingService: UploadingService) {}

  @ApiConsumes('multipart/form-data', 'application/json')
  @Post('upload_thumbnail')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(
    @Req() req, 
    @Body() Body: UploadThumbnailUploadDto,
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

    const cid = await this.uploadingService.createUpload(file, body.video_id)

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

    return await this.uploadingService.createUpload(user, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('start_encode')
  async startEncode(@Body() body: StartEncodeDto) {
    return await this.uploadingService.startEncode(body.upload_id);
  }


  @ApiOperation({ summary: 'Updates the metadata of a pending upload [Work in progress]' })
  @Post('update_post')
  async postUpdate(@Body() body, @Req() req) {
    console.log(req)
    try {
      await this.uploadingService.postUpdate(body.id)
    } catch (error) {
      if (error.message === 'UnauthorizedAccessError') {
        throw new HttpException({ reason: "You do not have access to edit the requested post"}, HttpStatus.BAD_REQUEST);
      }
      // handle other errors or rethrow
    }
  }

  @Post('tus-callback')
  @ApiOperation({ summary: 'TUSd uploader callback. Internal use only' })
  async tusdCallback(@Body() body) {
    try {
      await this.uploadingService.handleTusdCallback(body.Upload);
    } catch (error) {
      if (error.message === 'TestAuthorizationError') {
        throw new HttpException({ error: 'Test authorization used' }, HttpStatus.BAD_REQUEST);
      }
      // handle other errors or rethrow
      throw error;
    }
  }
}
