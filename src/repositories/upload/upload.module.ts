import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadRepository } from './upload.repository';
import { UploadSchema } from './schemas/upload.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'uploads', schema: UploadSchema }], 'acela-core')],
  controllers: [],
  providers: [UploadRepository],
  exports: [UploadRepository],
})
export class UploadModule {}
