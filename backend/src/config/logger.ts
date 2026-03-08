import { createLogger, format, transports } from "winston";

export const logger = createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === "development"
          ? format.combine(format.colorize(), format.simple())
          : format.json()
    })
  ]
});