import Mailgun from 'mailgun-js'
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  readonly #mailGun: Mailgun;

  constructor(private configService: ConfigService) {
    // console.log(this.configService.get<string>('MAIL_GUN_SECRET'))
    // this.#mailGun = new Mailgun({
    //   apiKey: this.configService.get<string>('MAIL_GUN_SECRET'),
    //   domain: this.configService.get<string>('MAIL_GUN_DOMAIN'),
    // })
  }

  async send(email: string, subject: string, html: string) { 
    await this.#mailGun.messages().send(
      {
        from: `noreply@${this.configService.get('MAIL_GUN_DOMAIN')}`,
        to: email,
        subject,
        html,
      },
      (err: any, info: any) => {
        console.log('[mailer]', 'confirm_signup', err, info)
      },
    )
  }

  async sendRegistration(email: string, email_code) {
    await this.send(
      email,
      'Complete 3Speak registration',
      `test registration. Click <a href=\"http://${this.configService.get('PUBLIC_CALLBACK_URL') || "localhost:4569"}/api/v1/auth/verifyemail?code=${email_code}\">here</a> to verify email address.`
    )
  }
}
