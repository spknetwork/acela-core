import {
  UseGuards,
  Get,
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
  Logger,
} from '@nestjs/common';
import { FileInterceptor, MulterModule } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { RequireHiveVerify, UserDetailsInterceptor } from '../api/utils';
import { ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { UploadThumbnailUploadDto } from './dto/upload-thumbnail.dto';
import { UpdateUploadDto } from './dto/update-upload.dto';
import { StartEncodeDto } from './dto/start-encode.dto';
import { UploadingService } from './uploading.service';
import { HiveRepository } from '../../repositories/hive-chain/hive-chain.repository';
import { Upload } from './uploading.types';
import { parseAndValidateRequest } from '../auth/auth.utils';

MulterModule.registerAsync({
  useFactory: () => ({
    dest: process.env.UPLOAD_PATH || './upload',
  }),
});

@Controller('/api/v1/upload')
export class UploadingController {
  readonly #logger = new Logger(UploadingController.name);

  constructor(
    private readonly uploadingService: UploadingService,
    private readonly hiveRepository: HiveRepository,
  ) {}

  @ApiConsumes('multipart/form-data', 'application/json')
  @Post('thumbnail')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(
    @Req() req: { user: { sub: string; username: string } },
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
    // console.log(body)

    /**
     * TODO: do a bit more verification of user authority
     */

    const cid = await this.uploadingService.uploadThumbnail(file, Body.video_id, req.user);

    return {
      status: 'ok',
      thumbnail_cid: cid,
    };
  }

  //Sequence matters
  @ApiOperation({ summary: 'Creates post metadata container' })
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @UseInterceptors(UserDetailsInterceptor)
  @Get('create_upload')
  async createUpload(
    @Request()
    request: unknown,
  ) {
    const parsedRequest = parseAndValidateRequest(request, this.#logger);
    return this.uploadingService.createUpload(parsedRequest.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @Post('start_encode')
  async startEncode(@Body() body: StartEncodeDto, @Request() req) {
    const request = parseAndValidateRequest(req, this.#logger);
    if (request.user.network !== 'hive') {
      throw new HttpException(
        'Must be signed in with a hive account to perform this operation',
        HttpStatus.FORBIDDEN,
      );
    }
    const username: string = request.user.username;
    const accountDetails = await this.hiveRepository.getAccount(username);
    // Check 1: Do we have posting authority?
    if (this.hiveRepository.verifyPostingAuth(accountDetails) === false) {
      const reason = `Hive Account @${username} has not granted posting authority to @threespeak`;
      const errorType = 'MISSING_POSTING_AUTHORITY';
      throw new HttpException({ reason: reason, errorType: errorType }, HttpStatus.FORBIDDEN);
    }
    // Check 2: Is post title too big or too small?
    const videoTitleLength = await this.uploadingService.getVideoTitleLength(
      body.permlink,
      username,
    );
    if (videoTitleLength === 0) {
      throw new HttpException(
        { reason: 'Video title is not set', errorType: 'NO_VIDEO_TITLE' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (videoTitleLength >= 255) {
      throw new HttpException(
        { reason: 'Video title is too big. Please update it.', errorType: 'BIG_VIDEO_TITLE' },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Check 3: Is this post already published?
    const postExists = await this.hiveRepository.hivePostExists({
      author: username,
      permlink: body.permlink,
    });
    if (postExists) {
      throw new HttpException(
        { reason: 'Post already exists on Hive Blockchain', errorType: 'POST_EXISTS' },
        HttpStatus.BAD_REQUEST,
      );
    }
    // TO-DO: Check 4: Does user have enough RC?
    const hasEnoughRC = await this.hiveRepository.hasEnoughRC({ author: username });
    if (!hasEnoughRC) {
      throw new HttpException(
        { reason: 'User has RC below 6b', errorType: 'LOW_RC' },
        HttpStatus.BAD_REQUEST,
      );
    }
    // All check went well? let's encode & publish
    return await this.uploadingService.startEncode(
      body.upload_id,
      body.video_id,
      body.permlink,
      username,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @Post('update_post')
  async postUpdate(@Body() reqBody: UpdateUploadDto) {
    try {
      await this.uploadingService.postUpdate(reqBody);
    } catch (error) {
      if (error.message === 'UnauthorizedAccessError') {
        throw new HttpException(
          { reason: 'You do not have access to edit the requested post' },
          HttpStatus.BAD_REQUEST,
        );
      }
      // handle other errors or rethrow
    }
  }

  @Post('tus-callback')
  @ApiOperation({ summary: 'TUSd uploader callback. Internal use only' })
  async tusdCallback(@Body() body: { Upload: Upload }, @Headers() headers) {
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
