import path from "path";
import { existsSync } from "fs";
import { logger } from "./logger";

export function getTemplateFolderPath(): string {
  const possiblePaths = [
    path.resolve(__dirname, "../../..", "templates"),
    path.resolve(process.cwd(), "templates"),
    path.resolve(process.cwd(), "apps/server/templates"),
  ];

  for (const templatePath of possiblePaths) {
    if (existsSync(templatePath)) {
      logger.info(`Template folder found at: ${templatePath}`);
      return templatePath;
    }
  }

  const errorMsg = `Template folder not found. Checked locations:\n${possiblePaths.join("\n")}`;
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

export function getTemplateFilePath(templateName: string): string {
  const basePath = getTemplateFolderPath();
  const fullPath = path.resolve(basePath, `${templateName}.ejs`);

  if (!existsSync(fullPath)) {
    const errorMsg = `Template file not found: ${fullPath}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  return fullPath;
}
