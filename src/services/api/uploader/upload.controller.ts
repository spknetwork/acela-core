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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '@nestjs/passport'
import moment from 'moment'
import {v4 as uuid} from 'uuid'
import { appContainer } from '..'
import { RequireHiveVerify, UserDetailsInterceptor } from '../utils'

@Controller('/api/v1')
export class UploadController {
  @Post('upload_thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  async uploadThumbnail(
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
    console.log(file)
  }

  //Sequence matters
  @UseGuards(AuthGuard('jwt'), RequireHiveVerify)
  @UseInterceptors(UserDetailsInterceptor)
  @Post('create_upload')
  async createUpload(@Request() req) {
    const body = req.body

    console.log(body, req.headers, req.user)
    const id = uuid();

    await appContainer.self.uploadsDb.insertOne({
        id: uuid(),
        expires: moment().add('1', 'day').toDate(),
        created_by: req.user.sub
    })

    return {
        id
    }
    // console.log(body, appContainer.self.uploadsDb, req.user)
  }


  @Post('update_post')
  async postUpdate(@Body() body) {
    console.log(body)
    
    const uploadedInfo = await appContainer.self.uploadsDb.findOne({
      id: body.id
    })

    if(uploadedInfo.created_by === body.id) {
      const updatedInfo = await appContainer.self.uploadsDb.findOneAndUpdate({
        id: body.id
      }, {
        $set: {
  
        }
      })

      console.log(uploadedInfo)
      
    } else {
      throw new HttpException({ reason: "You do not have access to edit the requested post"}, HttpStatus.BAD_REQUEST)
    }
    
  }

  @Post('tus-callback')
  async tusdCallback(@Body() body) {
    console.log('TUSD CALLBACK HAPPENING', body)
    if(body.Upload.MetaData.authorization === "TESTING") {
      throw new HttpException({ error: 'Test authorization used' }, HttpStatus.BAD_REQUEST)
    }
    // console.log(req)
  }
}
