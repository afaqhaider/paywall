import { Injectable, Logger } from "@nestjs/common";

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

/**
 * No real transactional email provider is wired up yet (the platform must run
 * fully locally with no cloud dependencies). This logs the message — including
 * the verification/reset link — to stdout so it can be copy-pasted during local
 * development and testing. Swap this implementation for a real SMTP/provider
 * client before shipping to real users.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `\n----- OUTBOUND EMAIL -----\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.body}\n---------------------------\n`,
    );
    return Promise.resolve();
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Verify your SS Zentronics Platform email",
      body: `Welcome! Verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Reset your SS Zentronics Platform password",
      body: `Reset your password by visiting:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    });
  }
}
