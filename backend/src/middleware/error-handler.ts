import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

export function errorHandler(
  error: Error & { statusCode?: number; details?: unknown },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    logger.error(error.message, { stack: error.stack });
  }

  return res.status(statusCode).json({
    message: error.message || "Erro interno do servidor",
    details: error.details
  });
}