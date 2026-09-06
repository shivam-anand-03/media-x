import { type Job } from "bullmq";
import { BaseQueueService } from "../services/base-queue.service";
import { EmailService } from "../services/email.service";
import { cache } from "../configs/redis.config";
import { logger } from "../helper/logger";
import { envs } from "../configs/envs.config";
import { jobConfig } from "../constants/variable";
import { EmailUtils } from "../utils/email-utils";
import { AuthUtils } from "../utils/auth-utils";
import { createJobId } from "../helper/global";

const JobType = ["OTP", "WELCOME", "RESET_PASSWORD"] as const;
type JobType = (typeof JobType)[number];

interface EmailQueuePayload {
  email: string;
  userName: string;
  userId?: string;
  type: JobType;
}

export class EmailQueue extends BaseQueueService<EmailQueuePayload> {
  constructor() {
    super("email-queue", 100);
  }

  async handler(job: Job<EmailQueuePayload>): Promise<void> {
    try {
      switch (job.data.type) {
        case JobType["0"]:
          await this.handleOtp(job.data);
          break;
        case JobType["1"]:
          await this.handleWelcome(job.data);
          break;
        case JobType["2"]:
          await this.handleResetPassword(job.data);
          break;
        default:
          logger.warn("Unknown job type", { type: job.data.type });
      }
    } catch (error) {
      logger.error("Error occurred while processing email job", { error });
      throw error;
    }
  }

  private async handleOtp(data: EmailQueuePayload) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const html = await EmailUtils.generateOTPHTML(data.userName, otp);

    await EmailService.sendEmail({
      to: data.email,
      subject: "Your OTP Code",
      html,
    });

    await cache.set(`otp:${data.email}`, otp, "EX", 300);

    logger.info("OTP email sent", { email: data.email });
  }

  private async handleWelcome(data: EmailQueuePayload) {
    const html = await EmailUtils.generateWELCOME(data.userName);

    await EmailService.sendEmail({
      to: data.email,
      subject: "Welcome!",
      html,
    });

    logger.info("Welcome email sent", { email: data.email });
  }

  private async handleResetPassword({
    email,
    userId,
    userName,
  }: EmailQueuePayload) {
    const token = AuthUtils.createResetPasswordToken(userId!);

    const resetLink = `${envs.CLIENT_APP_URL}/reset-password?token=${token}`;

    const html = await EmailUtils.generateRESET_PASSWORD_HTML(
      userName,
      resetLink,
    );

    await EmailService.sendEmail({
      to: email,
      subject: "Reset your password",
      html,
    });

    logger.info("Reset password email sent", {
      email,
      userId,
    });
  }

  public sendOtp(email: string, userName: string) {
    return this.addJob(
      JobType["0"],
      { email, userName, type: JobType["0"] },
      {
        ...jobConfig,
        jobId: createJobId("otp"),
      },
    );
  }

  public sendWelcomeEmail(email: string, userName: string) {
    return this.addJob(
      JobType["1"],
      { email, userName, type: JobType["1"] },
      {
        ...jobConfig,
        jobId: createJobId("welcome"),
      },
    );
  }

  public sendResetPasswordEmail(
    email: string,
    userName: string,
    userId: string,
  ) {
    return this.addJob(
      JobType["2"],
      { email, userName, userId, type: JobType["2"] },
      {
        ...jobConfig,
        jobId: createJobId("reset-password"),
      },
    );
  }
}

export default new EmailQueue();
