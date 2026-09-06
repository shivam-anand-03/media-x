import path from "path";
import { existsSync } from "fs";
import { logger } from "../helper/logger";

/**
 * Automatically resolves the template folder path based on project structure
 * Checks multiple possible locations and throws error if not found
 */
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

/**
 * Get full path to a specific template file with validation
 */
export function getTemplateFilePath(templateName: string): string {
  const basePath = getTemplateFolderPath();
  const fullPath = path.resolve(basePath, `${templateName}.ejs`);

  if (!existsSync(fullPath)) {
    const errorMsg = `❌ Template file not found: ${fullPath}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  return fullPath;
}
