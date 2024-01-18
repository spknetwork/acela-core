export class CreateUserAccountDto {
  readonly email: string;
  readonly password: string;
  readonly email_code?: string;
  readonly status?: string = 'unverified';
  readonly email_status?: string = 'unverified';
  readonly type?: string = 'multi';
  readonly created_at?: Date = new Date();
  readonly updated_at?: Date = new Date();
  readonly last_login_at?: Date = new Date();
  readonly password_reset_at?: Date = null;
}