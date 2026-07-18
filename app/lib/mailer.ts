import nodemailer from "nodemailer";
import type { EmailAccount } from "./types";

interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

export function createTransport(account: EmailAccount) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_port === 465,
    auth: {
      user: account.smtp_user,
      pass: account.smtp_pass,
    },
  });
}

export async function sendEmail(account: EmailAccount, opts: SendOptions) {
  const transport = createTransport(account);

  const info = await transport.sendMail({
    from: `"${account.sender_name}" <${account.sender_email}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  return info;
}

const WARMUP_SCHEDULE = [
  { maxDay: 7,  limit: 5 },
  { maxDay: 14, limit: 15 },
  { maxDay: 21, limit: 30 },
  { maxDay: 28, limit: 60 },
  { maxDay: 35, limit: 120 },
];

export function getWarmupLimit(account: EmailAccount): number {
  if (!account.warmup_enabled || !account.warmup_start_date) {
    return account.daily_limit;
  }

  const start = new Date(account.warmup_start_date);
  const now = new Date();
  const daysSinceStart = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  for (const phase of WARMUP_SCHEDULE) {
    if (daysSinceStart < phase.maxDay) {
      return Math.min(phase.limit, account.daily_limit);
    }
  }

  return account.daily_limit;
}

export function canSendMore(account: EmailAccount): boolean {
  const limit = getWarmupLimit(account);
  return account.sends_today < limit;
}

export function getRemainingToday(account: EmailAccount): number {
  const limit = getWarmupLimit(account);
  return Math.max(0, limit - account.sends_today);
}
