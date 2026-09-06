import ejs from "ejs";
import fs from "fs";
import { getTemplateFilePath } from "./path-utils";

export class EmailUtils {
  private static readonly supportLink = "https://demo.xoidlabs.com/support";
  private static readonly currentDate = new Date().toLocaleDateString();

  private static generateExpiryMinutes(): number {
    return 5;
  }

  static async generateOTPHTML(userName: string, otp: string): Promise<string> {
    const template = fs.readFileSync(getTemplateFilePath("otp"), "utf-8");
    const data = {
      userName,
      otpCode: otp,
      expiryMinutes: this.generateExpiryMinutes(),
      supportLink: this.supportLink,
      currentDate: this.currentDate,
    };

    return ejs.render(template, data);
  }

  static async generateWELCOME(userName: string): Promise<string> {
    const template = fs.readFileSync(getTemplateFilePath("welcome"), "utf-8");

    const data = {
      userName,
    };

    return ejs.render(template, data);
  }

  static async generateRESET_PASSWORD_HTML(
    userName: string,
    resetPasswordLink: string,
  ): Promise<string> {
    const template = fs.readFileSync(
      getTemplateFilePath("reset-password"),
      "utf-8",
    );

    const data = {
      userName,
      resetPasswordLink,
    };

    return ejs.render(template, data);
  }
}
