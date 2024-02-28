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
  Param,
  Query,
  Headers,
} from '@nestjs/common'
import { FileInterceptor, MulterModule } from '@nestjs/platform-express'
import { AuthGuard } from '@nestjs/passport'
import { RequireHiveVerify, UserDetailsInterceptor } from '../api/utils'
import { ApiConsumes, ApiOperation, ApiProperty } from '@nestjs/swagger'
import { UploadThumbnailUploadDto } from './dto/upload-thumbnail.dto'
import { CreateUploadDto } from './dto/create-upload.dto'
import { StartEncodeDto } from './dto/start-encode.dto'
import { UploadingService } from './uploading.service'
import { v4 as uuid } from 'uuid'

MulterModule.registerAsync({
  useFactory: () => ({
    dest: process.env.UPLOAD_PATH || './upload',
  }),
});

@Controller('/api/v1/upload')
export class UploadingController {
  constructor(private readonly uploadingService: UploadingService) {}

  @ApiConsumes('multipart/form-data', 'application/json')
  @Post('thumbnail')
  //@UseGuards(AuthGuard('jwt'))
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

    const cid = await this.uploadingService.uploadThumbnail(file, body.video_id)

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
  async tusdCallback(@Body() body, @Headers() headers) {
    try {
      if (headers['hook-name'] === 'post-finish') {
        await this.uploadingService.handleTusdCallback(body.Upload);
      }
    } catch (error) {
      if (error.message === 'TestAuthorizationError') {
        throw new HttpException({ error: 'Test authorization used' }, HttpStatus.BAD_REQUEST);
      }
      // handle other errors or rethrow
      throw error;
    }
  }
}
