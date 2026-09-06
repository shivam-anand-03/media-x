import { EmailConfig } from "@/common/configs/email.config";

const emailConfig = new EmailConfig();
const transporter = emailConfig.getTransporter();

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  static async sendEmail({
    to,
    subject,
    html,
  }: SendEmailParams): Promise<void> {
    await transporter.sendMail({
      from: `"Trugent" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  }
}
