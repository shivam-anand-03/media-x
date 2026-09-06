import winston from "winston";
import { MongoLogTransport } from "./mongo-log-transport";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const consoleFormat = printf(
  ({ level, message, timestamp, stack, persist, ...meta }) => {
    return `${timestamp} ${level}: ${stack || message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ""
    }`;
  },
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),
    new MongoLogTransport({ level: "info" }),
  ],
});
