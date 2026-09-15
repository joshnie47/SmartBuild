import nodemailer from 'nodemailer';

/**
 * Safely mask an email address for development/production delivery logs.
 * Example: joethangaraj2004@gmail.com -> jo*****@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!local || !domain) return '***@***';
  const maskedLocal = local.length <= 2
    ? local[0] + '*'
    : local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 5));
  return `${maskedLocal}@${domain}`;
}

/**
 * Universal No-Domain Email Service for SmartBuild.
 * Uses Nodemailer with standard SMTP transport or Ethereal test inbox.
 *
 * Configurable in server/.env:
 * - SMTP_HOST (e.g. 'smtp.gmail.com' or 'smtp-relay.brevo.com' or 'smtp.mailtrap.io')
 * - SMTP_PORT (default: 587)
 * - SMTP_USER (e.g. email address or username)
 * - SMTP_PASS (e.g. App Password or API key)
 * - SMTP_SECURE ('true' for port 465, 'false' for 587/25)
 * - EMAIL_FROM (e.g. 'SmartBuild <no-reply@smartbuild.com>')
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (user && pass && user.trim() !== '' && pass.trim() !== '' && !user.includes('your_email')) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: user.trim(), pass: pass.trim() },
      tls: { rejectUnauthorized: false },
    });
  }

  return null;
}

/**
 * Send an OTP verification email to ANY recipient email address.
 * Does NOT require domain ownership, DNS, SPF, or DKIM verification.
 *
 * @param toEmail Recipient email address (e.g., user@gmail.com, user@psgtech.ac.in, user@yahoo.com)
 * @param otp 6-digit OTP code
 * @param title Purpose/title of the OTP email (default: 'Password Reset')
 */
export async function sendOtpEmail(toEmail: string, otp: string, title: string = 'Password Reset'): Promise<{ status: string; id?: string }> {
  const recipient = toEmail.toLowerCase().trim();
  const maskedTo = maskEmail(recipient);
  const fromAddress = process.env.EMAIL_FROM || 'SmartBuild <no-reply@smartbuild.com>';

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #1e3a5f; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SmartBuild</h1>
        <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 13px;">Constructing Your Future</p>
      </div>

      <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${title} Verification Code</h2>
      <p style="color: #4b5563; margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;">
        We received a request for your SmartBuild account. Use the verification code below to complete your request.
        This code is valid for <strong>10 minutes</strong>.
      </p>

      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="color: #fbbf24; font-size: 38px; font-weight: 700; letter-spacing: 10px; font-family: monospace;">${otp}</span>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
        If you did not request this verification code, please ignore this email or contact support if you have concerns.
        Do <strong>not</strong> share this verification code with anyone.
      </p>

      <div style="border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">
          &copy; ${new Date().getFullYear()} SmartBuild Platform. All rights reserved.
        </p>
      </div>
    </div>
  `;

  const text = `SmartBuild ${title} Verification Code: ${otp}\nValid for 10 minutes. Do not share this code with anyone.`;

  const transporter = createTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject: `${otp} — Your SmartBuild ${title} Code`,
        text,
        html,
      });

      const messageId = info.messageId || 'unknown-id';
      console.log(`[EMAIL] provider=Nodemailer-SMTP from=${fromAddress} to=${maskedTo} status=accepted id=${messageId}`);
      return { status: 'accepted', id: messageId };
    } catch (err: any) {
      console.error(`[EMAIL] provider=Nodemailer-SMTP from=${fromAddress} to=${maskedTo} status=rejected error="${err.message || err}"`);
      throw new Error(`Failed to send ${title.toLowerCase()} email: ${err.message || 'SMTP error'}`);
    }
  } else {
    // DEV / Test Console Fallback Mode (when live SMTP user/pass are not set in .env)
    const devId = `dev-msg-${Date.now()}`;
    console.log(`[EMAIL] provider=Nodemailer-DEV from=${fromAddress} to=${maskedTo} status=logged id=${devId}`);
    console.log('=====================================================');
    console.log(`🔑 DEV OTP FOR ${maskedTo}: ${otp}`);
    console.log(`   To send live network emails directly to Gmail/PSG Tech inboxes without domain verification, set SMTP_USER & SMTP_PASS in server/.env`);
    console.log('=====================================================');
    return { status: 'logged', id: devId };
  }
}

/**
 * Send a password-reset OTP email.
 */
export async function sendPasswordResetEmail(toEmail: string, otp: string): Promise<{ status: string; id?: string }> {
  return sendOtpEmail(toEmail, otp, 'Password Reset');
}

/**
 * Send a PIN-reset OTP email.
 */
export async function sendPinResetEmail(toEmail: string, otp: string): Promise<{ status: string; id?: string }> {
  return sendOtpEmail(toEmail, otp, 'PIN Reset');
}
