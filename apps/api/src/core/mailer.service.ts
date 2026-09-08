import { Inject, Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { SERVER_ENV, type ServerEnv } from "./env.module";

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(SERVER_ENV) env: ServerEnv) {
    this.from = env.SMTP_FROM;
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    // Never log email body/token content — only that a send was attempted.
    this.logger.log(`Sending email to ${maskEmail(options.to)}: ${options.subject}`);
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Verify your Expense SaaS email address",
      text: `Welcome! Verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, ignore this email.`,
      html: `<p>Welcome! Verify your email by clicking the link below.</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 24 hours. If you didn't create this account, ignore this email.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Reset your Expense SaaS password",
      text: `We received a request to reset your password. Visit: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
    });
  }

  async sendAccountDeletionConfirmationEmail(
    to: string,
    confirmUrl: string,
    graceDays: number,
  ): Promise<void> {
    await this.send({
      to,
      subject: "Confirm your Expense SaaS account deletion",
      text: `We received a request to permanently delete your account and all its data. Confirm by visiting: ${confirmUrl}\n\nOnce confirmed, your data will be permanently deleted after a ${graceDays}-day grace period, during which you can still cancel. If you didn't request this, ignore this email — nothing happens without confirmation.`,
      html: `<p>We received a request to permanently delete your account and all its data.</p><p><a href="${confirmUrl}">Confirm account deletion</a></p><p>Once confirmed, your data will be permanently deleted after a ${graceDays}-day grace period, during which you can still cancel. If you didn't request this, ignore this email — nothing happens without confirmation.</p>`,
    });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local === undefined) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}
