import FormData from 'form-data';
import Mailgun from 'mailgun.js'
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IMailgunClient } from 'mailgun.js/Interfaces';

@Injectable()
export class EmailService {
  readonly #mailGun: IMailgunClient;
  readonly #logger: Logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const mailGun = new Mailgun(FormData);
    this.#mailGun = mailGun.client({username: 'api', key: this.configService.get('MAIL_GUN_KEY', 'key-yourkeyhere')});
  }

  async send(email: string, subject: string, html: string) { 
    await this.#mailGun.messages.create(this.configService.get('MAIL_GUN_DOMAIN') ?? '', {
      from: `Threespeak <noreply@${this.configService.get('MAIL_GUN_DOMAIN')}>`,
      to: [email],
      subject,
      html,
    }).catch((err: any) => {
      this.#logger.log('[mailer]', 'confirm_signup', err)
    })
  }

  async sendRegistration(email: string, email_code) {
    await this.send(
      email,
      'Complete 3Speak registration',
      `test registration. Click <a href=\"http://${this.configService.get('PUBLIC_CALLBACK_URL') || "localhost:4569"}/api/v1/auth/verifyemail?code=${email_code}\">here</a> to verify email address.`
    )
  }
}
