import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  IsLocale,
  Max,
  ValidateNested,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { BeneficiarySchema } from '../../../repositories/video/schemas/video.schema';

export class Beneficiary {
  @ApiProperty({
    description: 'Account name of the beneficiary',
    default: 'some-account',
  })
  @IsString()
  @IsNotEmpty()
  account: string;

  @ApiProperty({
    description: 'Weight of the beneficiary',
    default: 1000,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  weight: number;
}

export class UpdateUploadDto {
  @ApiProperty({
    description: 'Video Identifier',
    default: 'some-unique-id-generated-in-create_upload-api',
  })
  @IsString()
  @IsNotEmpty()
  video_id: string;

  @ApiProperty({
    description: 'permlink of hive-post generated during create_upload API',
    default: 'permlink',
  })
  @IsString()
  @IsNotEmpty()
  permlink: string;

  @ApiProperty({
    description: 'Title of the post',
    default: 'Your video title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Description of the post',
    default: 'This video is a test video. Here we can put a description',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    description: 'Tags for the post',
    default: ['threespeak', 'acela-core'],
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({
    description: 'Community',
    default: 'hive-181335',
  })
  @IsString()
  @IsNotEmpty()
  community: string;

  @ApiProperty({
    description: 'Array of beneficiaries for the post',
    default: [
      { account: 'threespeak', weight: 1000 },
      { account: 'acela-core', weight: 1000 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiarySchema)
  beneficiaries: BeneficiarySchema[];

  @ApiProperty({
    description: 'Language of the video in ISO 639-1 format',
    default: 'en',
  })
  @IsString()
  @IsLocale()
  @IsOptional()
  language?: string;

  @ApiProperty({
    description: 'original file name',
    default: 'bla-bla-bla.mp4',
  })
  @IsString()
  @IsNotEmpty()
  originalFilename: string;

  @ApiProperty({
    description: 'file name which TUSd provided',
    default: 'e1e7903087f9c39ac1645d69f5bb96cd',
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: 'file size in bytes number',
    default: '32330',
  })
  @IsNumber()
  @IsPositive()
  size: number;

  @ApiProperty({
    description: 'Video duration in seconds',
    default: '98',
  })
  @IsInt()
  @Min(1)
  duration: number;

  @ApiProperty({
    description:
      'A date in the future that represents when this video should be published to hive.',
    default: () => new Date().toISOString(),
  })
  @IsDateString()
  @IsOptional()
  publish_date?: string;

  @ApiProperty({
    description: 'Username for the hive account associated with this video',
    default: 'starkerz',
  })
  @IsString()
  @IsNotEmpty()
  owner: string;
}
