import nodemailer, { Transporter } from "nodemailer";
import { envs } from "./envs.config";
import { logger } from "../helper/logger";

export class EmailConfig {
  private readonly transporter: Transporter;

  private readonly emailOptions = {
    service: envs.EMAIL_SERVICE || "gmail",
    host: envs.EMAIL_HOST || "smtp.gmail.com",
    port: Number(envs.EMAIL_PORT),
    secure: true,
    auth: {
      user: envs.EMAIL_USER,
      pass: envs.EMAIL_PASS,
    },
  };

  constructor() {
    this.transporter = nodemailer.createTransport(this.emailOptions);
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info("Email server connection verified");
      return true;
    } catch (error) {
      logger.error("Email connection failed:", error);
      return false;
    }
  }

  public getTransporter(): Transporter {
    return this.transporter;
  }
}
