import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.porkbun.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Kosh AutoTrader" <${process.env.SMTP_USER || "hello@kosh.trade"}>`;

export async function sendTradeNotification(
  to: string,
  trade: { ticker: string; action: string; qty: number; price: number | null; reason: string }
) {
  const isBuy = trade.action === "BUY";
  const color = isBuy ? "#10b981" : "#ef4444";
  const icon = isBuy ? "🟢" : "🔴";

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `${icon} ${trade.action} ${trade.ticker} — ${trade.qty} shares`,
      html: `
<div style="font-family:sans-serif;padding:24px;background:#0a0a0f;color:#e5e7eb;">
  <div style="max-width:480px;margin:0 auto;">
    <h2 style="color:${color};margin:0 0 12px;">
      ${icon} ${trade.action} ${trade.ticker}
    </h2>
    <div style="background:#111118;border:1px solid #1f2937;border-radius:12px;padding:20px;">
      <p><strong style="color:#fff;">Shares:</strong> ${trade.qty}</p>
      ${trade.price ? `<p><strong style="color:#fff;">Price:</strong> $${trade.price.toFixed(2)}</p>` : ""}
      <p><strong style="color:#fff;">Reason:</strong> ${trade.reason}</p>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">
        ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET
      </p>
    </div>
    <p style="color:#374151;font-size:11px;margin-top:16px;text-align:center;">
      Kosh.trade AutoTrader — <a href="https://kosh.trade/trading" style="color:#818cf8;">View Dashboard</a>
    </p>
  </div>
</div>`,
    });
  } catch (e) {
    console.error("[Notifications] Trade email failed:", e);
  }
}

interface DailySummaryData {
  equity: number;
  dailyPnl: number;
  todayTrades: any[];
  openPositions: any[];
}

export async function sendDailySummary(to: string, data: DailySummaryData) {
  const pnlColor = data.dailyPnl >= 0 ? "#10b981" : "#ef4444";
  const pnlSign = data.dailyPnl >= 0 ? "+" : "";

  const tradeRows = data.todayTrades
    .map(
      (t: any) =>
        `<tr>
          <td style="padding:6px 12px;color:#fff;">${t.ticker}</td>
          <td style="padding:6px 12px;color:${t.side === "BUY" ? "#10b981" : "#ef4444"};">${t.side}</td>
          <td style="padding:6px 12px;color:#9ca3af;">${t.qty}</td>
          <td style="padding:6px 12px;color:#9ca3af;">$${(t.entryPrice || t.exitPrice || 0).toFixed(2)}</td>
          <td style="padding:6px 12px;color:${(t.pnl || 0) >= 0 ? "#10b981" : "#ef4444"};">${t.pnl ? `$${t.pnl.toFixed(2)}` : "—"}</td>
        </tr>`
    )
    .join("");

  const openRows = data.openPositions
    .map(
      (t: any) =>
        `<tr>
          <td style="padding:6px 12px;color:#fff;">${t.ticker}</td>
          <td style="padding:6px 12px;color:#9ca3af;">${t.qty} shares</td>
          <td style="padding:6px 12px;color:#9ca3af;">$${(t.entryPrice || 0).toFixed(2)}</td>
          <td style="padding:6px 12px;color:#9ca3af;">${t.strategy || "—"}</td>
        </tr>`
    )
    .join("");

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: `📊 Daily Summary — ${pnlSign}$${Math.abs(data.dailyPnl).toFixed(2)} | Portfolio $${data.equity.toFixed(2)}`,
      html: `
<div style="font-family:sans-serif;padding:24px;background:#0a0a0f;color:#e5e7eb;">
  <div style="max-width:560px;margin:0 auto;">
    <h2 style="color:#818cf8;margin:0 0 16px;">Daily Trading Summary</h2>
    
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#111118;border:1px solid #1f2937;border-radius:12px;padding:16px;text-align:center;">
        <p style="color:#6b7280;font-size:12px;margin:0;">Portfolio</p>
        <p style="color:#fff;font-size:20px;font-weight:700;margin:4px 0 0;">$${data.equity.toFixed(2)}</p>
      </div>
      <div style="flex:1;background:#111118;border:1px solid #1f2937;border-radius:12px;padding:16px;text-align:center;">
        <p style="color:#6b7280;font-size:12px;margin:0;">Today's P&L</p>
        <p style="color:${pnlColor};font-size:20px;font-weight:700;margin:4px 0 0;">${pnlSign}$${Math.abs(data.dailyPnl).toFixed(2)}</p>
      </div>
    </div>

    ${data.todayTrades.length > 0 ? `
    <h3 style="color:#9ca3af;font-size:14px;margin:0 0 8px;">Today's Trades (${data.todayTrades.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:#111118;border:1px solid #1f2937;border-radius:8px;overflow:hidden;font-size:13px;">
      <tr style="background:#1a1a24;">
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Ticker</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Side</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Qty</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Price</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">P&L</th>
      </tr>
      ${tradeRows}
    </table>` : "<p style='color:#6b7280;font-size:13px;'>No trades today.</p>"}

    ${data.openPositions.length > 0 ? `
    <h3 style="color:#9ca3af;font-size:14px;margin:20px 0 8px;">Open Positions (${data.openPositions.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:#111118;border:1px solid #1f2937;border-radius:8px;overflow:hidden;font-size:13px;">
      <tr style="background:#1a1a24;">
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Ticker</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Size</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Entry</th>
        <th style="padding:8px 12px;text-align:left;color:#6b7280;">Strategy</th>
      </tr>
      ${openRows}
    </table>` : ""}

    <p style="color:#374151;font-size:11px;margin-top:20px;text-align:center;">
      Kosh.trade AutoTrader — <a href="https://kosh.trade/trading" style="color:#818cf8;">View Dashboard</a>
    </p>
  </div>
</div>`,
    });
  } catch (e) {
    console.error("[Notifications] Daily summary email failed:", e);
  }
}
