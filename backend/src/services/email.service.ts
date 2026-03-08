import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: nodemailer.Transporter | null = null;

if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
} else {
  logger.warn("SMTP nao configurado. Emails serao apenas logados.");
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!transporter) {
    logger.info("Email nao enviado por falta de SMTP", {
      to: params.to,
      subject: params.subject
    });
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html
  });
}