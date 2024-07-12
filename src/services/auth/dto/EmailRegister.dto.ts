import { IsEmail, IsNotEmpty, IsStrongPassword, Matches } from 'class-validator';

export class EmailRegisterDto {
  @IsEmail()
  @Matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    message: 'Email must be a valid email address',
  })
  @IsNotEmpty()
  email: string;

  @IsStrongPassword({
    minLength: 7,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @IsNotEmpty()
  password: string;
}
