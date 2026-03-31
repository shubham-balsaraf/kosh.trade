import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name?.split(" ")[0] || "there";

  try {
    await transporter.sendMail({
      from: `"Kosh.trade" <${process.env.SMTP_USER}>`,
      to,
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
        <div style="display:flex;align-items:flex-start;">
          <span style="color:#818cf8;font-size:18px;margin-right:12px;">&#127919;</span>
          <div>
            <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">Market Sentiment</p>
            <p style="color:#6b7280;font-size:13px;margin:2px 0 0;">Live Fear & Greed index, dip finder, and signals</p>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin:28px 0 8px;">
        <a href="https://kosh.trade/search" style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;">
          Analyse Your First Stock
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
    notifyNewSignup(to, name).catch(() => {});

    return true;
  } catch (err) {
    console.error("[EMAIL] Failed to send welcome email:", err);
    return false;
  }
}

const ADMIN_EMAIL = "shubhambalsaraf73@gmail.com";

async function notifyNewSignup(userEmail: string, name: string) {
  try {
    await transporter.sendMail({
      from: `"Kosh.trade" <${process.env.SMTP_USER}>`,
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
  } catch {
    console.error("[EMAIL] Failed to send admin notification");
  }
}
