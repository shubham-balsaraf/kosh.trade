import nodemailer from "nodemailer";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const host = process.env.SMTP_HOST || "smtp.porkbun.com";
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      console.error("[EMAIL] SMTP_USER or SMTP_PASS not set in environment");
    }

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    console.log(`[EMAIL] Transporter created: ${user}@${host}:${port}`);
  }
  return _transporter;
}

const ADMIN_EMAIL = "shubhambalsaraf73@gmail.com";

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name?.split(" ")[0] || "there";
  const from = `"Kosh.trade" <${process.env.SMTP_USER || "hello@kosh.trade"}>`;

  console.log(`[EMAIL] Sending welcome email to ${to} from ${from}`);

  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from,
      to,
      bcc: ADMIN_EMAIL,
      subject: `Welcome to Kosh.trade, ${firstName}!`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;margin:0;">
        <span style="color:#818cf8;">K</span>osh<span style="color:#6366f1;">.trade</span>
      </h1>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0;">Fundamental Analysis, Simplified</p>
    </div>

    <div style="background:#111118;border:1px solid #1f2937;border-radius:16px;padding:32px 24px;">
      <h2 style="color:#ffffff;font-size:22px;margin:0 0 8px;">Hey ${firstName} &#128075;</h2>
      <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Welcome aboard! Your free Kosh.trade account is ready. Here's what you can do:
      </p>

      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;">
          <span style="color:#818cf8;font-size:18px;margin-right:12px;">&#128200;</span>
          <div>
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">AI-Powered Stock Analysis</p>
            <p style="color:#6b7280;font-size:13px;margin:2px 0 0;">Get Claude AI's fundamental verdict on any US stock</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;">
          <span style="color:#818cf8;font-size:18px;margin-right:12px;">&#128202;</span>
          <div>
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">Deep Fundamentals</p>
            <p style="color:#6b7280;font-size:13px;margin:2px 0 0;">Revenue, margins, FCF, valuation, health scores & more</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;">
          <span style="color:#818cf8;font-size:18px;margin-right:12px;">&#127919;</span>
          <div>
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">KoshPilot AI Trading</p>
            <p style="color:#6b7280;font-size:13px;margin:2px 0 0;">AI-powered auto-trading with paper or real money</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;">
          <span style="color:#818cf8;font-size:18px;margin-right:12px;">&#128176;</span>
          <div>
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">Congressional Trades</p>
            <p style="color:#6b7280;font-size:13px;margin:2px 0 0;">Track what Congress is buying and selling in real time</p>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin:28px 0 8px;">
        <a href="https://kosh.trade/dashboard" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;">
          Go to Dashboard
        </a>
      </div>

      <p style="color:#4b5563;font-size:12px;text-align:center;margin:20px 0 0;">
        Free accounts get 15 unique stock analyses. Need more?
        <a href="https://kosh.trade/pricing" style="color:#818cf8;text-decoration:none;">Upgrade to Pro</a>
      </p>
    </div>

    <div style="text-align:center;margin-top:32px;">
      <p style="color:#374151;font-size:11px;margin:0;">
        Questions? Reply to this email or visit
        <a href="https://kosh.trade/support" style="color:#6366f1;text-decoration:none;">kosh.trade/support</a>
      </p>
      <p style="color:#1f2937;font-size:10px;margin:8px 0 0;">
        &copy; ${new Date().getFullYear()} Kosh.trade &mdash; Built for long-term investors
      </p>
    </div>
  </div>
</body>
</html>`,
    });

    console.log(`[EMAIL] Welcome email sent to ${to}, messageId: ${info.messageId}`);

    notifyNewSignup(to, name).catch((e) => {
      console.error("[EMAIL] Admin notification failed:", e);
    });

    return true;
  } catch (err: any) {
    console.error("[EMAIL] Failed to send welcome email:", err?.message || err);
    console.error("[EMAIL] SMTP config: host=%s port=%s user=%s",
      process.env.SMTP_HOST || "smtp.porkbun.com",
      process.env.SMTP_PORT || "587",
      process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 5)}...` : "NOT SET"
    );
    return false;
  }
}

async function notifyNewSignup(userEmail: string, name: string) {
  const from = `"Kosh.trade" <${process.env.SMTP_USER || "hello@kosh.trade"}>`;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from,
      to: ADMIN_EMAIL,
      subject: `New signup: ${name || userEmail}`,
      html: `
<div style="font-family:sans-serif;padding:20px;background:#111;color:#e5e7eb;border-radius:12px;">
  <h2 style="color:#818cf8;margin:0 0 16px;">New User Signed Up</h2>
  <p><strong style="color:#fff;">Name:</strong> ${name || "—"}</p>
  <p><strong style="color:#fff;">Email:</strong> ${userEmail}</p>
  <p><strong style="color:#fff;">Time:</strong> ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} IST</p>
  <hr style="border-color:#1f2937;margin:16px 0;">
  <p style="color:#6b7280;font-size:12px;">Total users: check via <code>psql</code> or <a href="https://kosh.trade/dashboard" style="color:#818cf8;">dashboard</a></p>
</div>`,
    });
    console.log(`[EMAIL] Admin notification sent for ${userEmail}, messageId: ${info.messageId}`);
  } catch (err: any) {
    console.error("[EMAIL] Failed to send admin notification:", err?.message || err);
  }
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const from = `"Kosh.trade" <${process.env.SMTP_USER || "hello@kosh.trade"}>`;
  const baseUrl = process.env.NEXTAUTH_URL || "https://kosh.trade";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const firstName = name?.split(" ")[0] || "there";

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject: "Reset your Kosh.trade password",
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:28px;margin:0;">
        <span style="color:#818cf8;">K</span>osh<span style="color:#6366f1;">.trade</span>
      </h1>
    </div>
    <div style="background:#111118;border:1px solid #1f2937;border-radius:16px;padding:32px 24px;">
      <h2 style="color:#ffffff;font-size:20px;margin:0 0 8px;">Password Reset</h2>
      <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Hey ${firstName}, we received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.
      </p>
      <div style="text-align:center;margin:28px 0 16px;">
        <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;">
          Reset Password
        </a>
      </div>
      <p style="color:#4b5563;font-size:12px;text-align:center;margin:16px 0 0;">
        If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#1f2937;font-size:10px;margin:0;">
        &copy; ${new Date().getFullYear()} Kosh.trade
      </p>
    </div>
  </div>
</body>
</html>`,
    });
    console.log(`[EMAIL] Password reset email sent to ${to}, messageId: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error("[EMAIL] Failed to send password reset email:", err?.message || err);
    return false;
  }
}

export async function sendRateLimitAlert(userEmail: string, reason: string) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Kosh.trade" <${process.env.SMTP_USER || "hello@kosh.trade"}>`,
      to: ADMIN_EMAIL,
      subject: `[RATE LIMIT] ${userEmail} - ${reason}`,
      html: `
<div style="font-family:sans-serif;padding:20px;background:#111;color:#e5e7eb;border-radius:12px;">
  <h2 style="color:#f59e0b;margin:0 0 16px;">Rate Limit Triggered</h2>
  <p><strong style="color:#fff;">User:</strong> ${userEmail}</p>
  <p><strong style="color:#fff;">Reason:</strong> ${reason}</p>
  <p><strong style="color:#fff;">Time:</strong> ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} IST</p>
</div>`,
    });
  } catch (err: any) {
    console.error("[EMAIL] Rate limit alert failed:", err?.message || err);
  }
}

export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "SMTP verification failed" };
  }
}
