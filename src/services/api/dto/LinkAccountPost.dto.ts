import { IsNotEmpty } from 'class-validator';

export class LinkAccountPostDto {
  @IsNotEmpty()
  username: string;
}
