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
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor, MulterModule } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { UserDetailsInterceptor } from '../api/utils';
import { ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { UploadThumbnailUploadDto } from './dto/upload-thumbnail.dto';
import { UpdateUploadDto } from './dto/update-upload.dto';
import { StartEncodeDto } from './dto/start-encode.dto';
import { UploadingService } from './uploading.service';
import { HiveChainRepository } from '../../repositories/hive-chain/hive-chain.repository';
import { Upload } from './uploading.types';
import { parseAndValidateRequest } from '../auth/auth.utils';
import { HiveService } from '../hive/hive.service';

MulterModule.registerAsync({
  useFactory: () => ({
    dest: process.env.UPLOAD_PATH || './upload',
  }),
});

@Controller('/v1/upload')
export class UploadingController {
  readonly #logger = new Logger(UploadingController.name);

  constructor(
    private readonly uploadingService: UploadingService,
    private readonly hiveChainRepository: HiveChainRepository,
    private readonly hiveService: HiveService,
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
  @UseGuards(AuthGuard('jwt'))
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
  @UseInterceptors(UserDetailsInterceptor)
  @Post('start_encode')
  async startEncode(@Body() body: StartEncodeDto, @Request() req) {
    const request = parseAndValidateRequest(req, this.#logger);
    const hiveUsername: string = body.username;
    if (
      !(await this.hiveService.isHiveAccountLinked(request.user.sub, hiveUsername)) &&
      !(request.user.username === hiveUsername && request.user.network)
    ) {
      throw new UnauthorizedException('Your account is not linked to the requested hive account');
    }
    const accountDetails = await this.hiveChainRepository.getAccount(hiveUsername);
    // Check 1: Do we have posting authority?
    if (this.hiveChainRepository.verifyPostingAuth(accountDetails) === false) {
      const reason = `Hive Account @${hiveUsername} has not granted posting authority to @threespeak`;
      const errorType = 'MISSING_POSTING_AUTHORITY';
      throw new HttpException({ reason: reason, errorType: errorType }, HttpStatus.FORBIDDEN);
    }
    // Check 2: Is post title too big or too small?
    const videoTitleLength = await this.uploadingService.getVideoTitleLength(
      body.permlink,
      hiveUsername,
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
    const postExists = await this.hiveChainRepository.hivePostExists({
      author: hiveUsername,
      permlink: body.permlink,
    });
    if (postExists) {
      throw new HttpException(
        { reason: 'Post already exists on Hive Blockchain', errorType: 'POST_EXISTS' },
        HttpStatus.BAD_REQUEST,
      );
    }
    // TO-DO: Check 4: Does user have enough RC?
    const hasEnoughRC = await this.hiveChainRepository.hasEnoughRC({ author: hiveUsername });
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
      hiveUsername,
    );
  }

  @UseGuards(AuthGuard('jwt'))
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
