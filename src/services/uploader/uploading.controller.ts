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
import { HiveRepository } from '../../repositories/hive/hive.repository'

MulterModule.registerAsync({
  useFactory: () => ({
    dest: process.env.UPLOAD_PATH || './upload',
  }),
});

@Controller('/api/v1/upload')
export class UploadingController {
  constructor(
    private readonly uploadingService: UploadingService,
    private readonly hiveRepository: HiveRepository,
  ) {}

  @ApiConsumes('multipart/form-data', 'application/json')
  @Post('thumbnail')
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

    const cid = await this.uploadingService.uploadThumbnail(file, body.video_id, user)

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
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @Post('start_encode')
  async startEncode(@Body() body: StartEncodeDto, @Request() req) {
    const user = req.user
    const username = user.username
    const accountDetails = await this.hiveRepository.getAccount(username);
    // Check 1: Do we have posting authority?
    if (this.hiveRepository.verifyPostingAuth(accountDetails) === false) {
      const reason = `Hive Account @${username} has not granted posting authority to @threespeak`;
      const errorType = "MISSING_POSTING_AUTHORITY";
      throw new HttpException({ reason: reason, errorType: errorType }, HttpStatus.BAD_REQUEST);
    }
    // Check 2: Is post title too big or too small?
    const videoTitleLength = await this.uploadingService.getVideoTitleLength(body.permlink, username);
    if (videoTitleLength === 0) {
      throw new HttpException({ reason: 'Video title is not set', errorType: 'NO_VIDEO_TITLE'}, HttpStatus.BAD_REQUEST);
    }
    if (videoTitleLength >= 255) {
      throw new HttpException({ reason: 'Video title is too big. Please update it.', errorType: 'BIG_VIDEO_TITLE'}, HttpStatus.BAD_REQUEST);
    }
    // Check 3: Is this post already published?
    const postExists = await this.hiveRepository.hivePostExists({author: username, permlink: body.permlink});
    if (postExists) {
      throw new HttpException({ reason: 'Post already exists on Hive Blockchain', errorType: 'POST_EXISTS'}, HttpStatus.BAD_REQUEST);
    }
    // TO-DO: Check 4: Does user have enough RC?
    // All check went well? let's encode & publish
    return await this.uploadingService.startEncode(body.upload_id, body.video_id, body.permlink, username);
  }


  @ApiOperation({ summary: 'Updates the metadata of a pending upload [Work in progress]' })
  @Post('update_post')
  async postUpdate(@Body() body, @Req() req) {
    // console.log(req)
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
