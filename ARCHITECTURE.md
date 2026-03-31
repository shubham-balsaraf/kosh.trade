# Kosh.trade — Architecture & System Documentation

> Full-stack AI-powered stock analysis and auto-trading platform.
> This document describes the complete system so any LLM or developer can understand and extend it.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js (JWT sessions, Google + Credentials) |
| AI | Anthropic Claude API |
| Trading | Alpaca API (paper + live) |
| Email | Nodemailer via Porkbun SMTP (`hello@kosh.trade`) |
| Hosting | Raspberry Pi (PM2 process manager) |
| Payments | Stripe (checkout + webhooks) |
| Market Data | Yahoo Finance (unofficial), FMP (Financial Modeling Prep) |

---

## Directory Structure

```
kosh/
├── prisma/
│   ├── schema.prisma          # Database schema (all models)
│   └── prisma.config.ts       # Prisma configuration
├── scripts/
│   └── cron-trading.sh        # Cron script for auto-trading
├── src/
│   ├── proxy.ts               # Next.js proxy (rate limiting)
│   ├── app/
│   │   ├── page.tsx           # Public landing page (kosh.trade)
│   │   ├── globals.css        # Global styles + animations
│   │   ├── (app)/             # Authenticated app routes
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── stock/[ticker] # Stock detail page
│   │   │   ├── trading/auto/  # KoshPilot auto-trading
│   │   │   ├── portfolio/     # Portfolio management
│   │   │   ├── signals/       # Market signals
│   │   │   ├── dip-finder/    # Dip finding tool
│   │   │   ├── settings/      # User settings
│   │   │   ├── support/       # Contact support
│   │   │   └── search/        # Stock search
│   │   └── api/               # API routes (see API section)
│   ├── components/
│   │   ├── ui/                # Reusable UI (Card, Badge, Button, StockLogo)
│   │   ├── charts/            # Chart components (Price, FCF, Margin)
│   │   ├── stock/             # Stock-specific (AIAnalysis, InsiderFlashcards)
│   │   └── congress/          # Congressional trades (CongressTrades, CongressShowcase)
│   └── lib/
│       ├── db.ts              # Prisma client singleton
│       ├── email.ts           # Email sending (welcome, admin alerts)
│       ├── rate-limit.ts      # DB-level rate limiting + ban logic
│       ├── ai/claude.ts       # Claude API wrapper
│       ├── auth/
│       │   ├── options.ts     # NextAuth configuration
│       │   └── tierCheck.ts   # Pro tier authorization helper
│       ├── api/
│       │   ├── fmp.ts         # FMP API wrapper (fundamentals)
│       │   ├── yahoo.ts       # Yahoo Finance API (quotes, charts)
│       │   └── alpaca.ts      # Alpaca API wrapper (trading)
│       └── trading/           # KoshPilot trading system
│           ├── engine.ts      # Core trading cycle orchestrator
│           ├── scanner.ts     # Market scanner (Yahoo data → indicators)
│           ├── indicators.ts  # Technical indicator calculations
│           ├── signals.ts     # Signal generation + ranking
│           ├── risk.ts        # Position sizing + exit logic
│           ├── executor.ts    # Alpaca order execution
│           ├── ai-analyst.ts  # Claude conviction scoring
│           ├── strategy.ts    # Portfolio allocation (unused)
│           └── notifications.ts # Trade email notifications
```

---

## Database Models (Prisma)

### Core Models
- **User** — Auth, tier (FREE/PRO), role (USER/ADMIN), Alpaca keys, ban status, API call tracking
- **Account** — OAuth provider accounts (Google)
- **Session** — NextAuth sessions (JWT-based, rarely used)
- **SearchHistory** — Tracks which stocks a user has analyzed (used for free tier limits)

### Portfolio Models
- **Portfolio** — User portfolios with cash balance
- **PortfolioHolding** — Individual holdings (ticker, shares, cost basis)
- **Trade** — Manual portfolio trades via Alpaca

### KoshPilot (Auto-Trading) Models
- **TradingConfig** — Per-user config: mode (PAPER/LIVE), paper balance, risk profile, watchlist, max positions, risk limits, weekly target
- **AutoTrade** — Each trade KoshPilot executes: entry/exit price, stop/take-profit, P&L, strategy, AI confidence, signal score

### Other Models
- **Alert** — Price/signal alerts
- **WatchlistItem** — User watchlist tickers

---

## API Routes

### Authentication
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler (Google + credentials) |
| `/api/auth/register` | POST | Email/password registration |

### Stock Data
| Route | Method | Description |
|-------|--------|-------------|
| `/api/stocks/search` | GET | Search stocks by query |
| `/api/stocks/[ticker]` | GET | Full stock data (FMP fundamentals) |
| `/api/stocks/[ticker]/analysis` | POST | AI analysis via Claude (rate limited) |
| `/api/stocks/[ticker]/earnings` | GET | Earnings history |
| `/api/stocks/[ticker]/fcf` | GET | Free cash flow data |
| `/api/stocks/[ticker]/news` | GET | News + sentiment (Yahoo + Google) |
| `/api/stocks/[ticker]/insiders` | GET | Insider trades (SEC EDGAR Form 4) |
| `/api/stocks/[ticker]/price` | GET | Live price quote |
| `/api/stocks/[ticker]/save` | POST | Save analysis to history (enforces free limit) |
| `/api/stocks/[ticker]/transcript` | GET | Earnings call transcript |

### KoshPilot (Auto-Trading)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/trading/auto` | GET | Get config, trades, stats, briefing |
| `/api/trading/auto` | POST | Run trading cycle (user or cron) |
| `/api/trading/auto` | PATCH | Update config (risk profile, watchlist, etc.) |
| `/api/trading/auto` | DELETE | Reset KoshPilot setup |
| `/api/trading/quotes` | GET | Live quotes for open positions |
| `/api/trading` | GET/POST | Manual Alpaca trading |

### Market & Signals
| Route | Method | Description |
|-------|--------|-------------|
| `/api/market/fear-greed` | GET | CNN Fear & Greed index |
| `/api/market/tickers` | GET | Ticker strip data |
| `/api/signals` | GET | Market signals |
| `/api/signals/pro` | GET | Pro-only signals |
| `/api/dip-finder` | GET | Dip finder |
| `/api/congress/trades` | GET | Congressional trades (scraped) |

### User & Admin
| Route | Method | Description |
|-------|--------|-------------|
| `/api/usage` | GET | API usage tracking (free tier limits) |
| `/api/settings` | GET/PATCH | User settings |
| `/api/portfolio` | CRUD | Portfolio management |
| `/api/alerts` | CRUD | Alert management |
| `/api/history` | GET/DELETE | Search history |
| `/api/support` | POST | Support form submission |
| `/api/stripe/*` | Various | Stripe checkout + webhooks |

---

## KoshPilot Trading Algorithm

### Overview
KoshPilot is a signal-based auto-trading system with two modes:
- **Paper Mode**: Simulates trades in the database (no real API calls)
- **Live Mode**: Executes real trades via Alpaca API with Claude AI conviction filtering

### Trading Cycle Flow

```
┌──────────────────────────────────────────────────────────┐
│                    TRADING CYCLE                         │
│                                                          │
│  1. CHECK EXITS                                          │
│     └── For each open position:                          │
│         ├── Fetch current price (Yahoo)                  │
│         ├── Check: stop loss hit?                        │
│         ├── Check: take profit hit?                      │
│         ├── Check: trailing stop (>5% gain)?             │
│         └── Check: max hold days exceeded?               │
│                                                          │
│  2. SCAN MARKET                                          │
│     └── For each ticker in watchlist:                    │
│         ├── Fetch 3-month daily chart (Yahoo)            │
│         └── Calculate technical indicators               │
│                                                          │
│  3. GENERATE & RANK SIGNALS                              │
│     └── For each scanned stock:                          │
│         ├── Score 8 signal components (weighted)         │
│         ├── Classify: STRONG_BUY / BUY / HOLD / SELL    │
│         ├── Set ATR-based stop loss & take profit        │
│         ├── Apply bearish-market penalty                 │
│         └── Sort by composite score (descending)         │
│                                                          │
│  4. AI CONVICTION (Live mode only)                       │
│     └── Send top 10 signals to Claude:                   │
│         ├── Claude scores 1-10 conviction per stock      │
│         ├── Skip stocks with conviction < 4              │
│         └── Adjust position sizing by AI confidence      │
│                                                          │
│  5. POSITION SIZING & ENTRY                              │
│     └── For each remaining signal:                       │
│         ├── Skip if already holding same ticker          │
│         ├── Skip if below risk profile thresholds        │
│         ├── Calculate position size (risk-adjusted)      │
│         ├── Check: daily loss limit, max positions       │
│         └── Execute buy (Alpaca or DB record)            │
│                                                          │
│  6. NOTIFICATIONS                                        │
│     └── Email trade confirmations to user                │
└──────────────────────────────────────────────────────────┘
```

### Technical Indicators (indicators.ts)

| Indicator | Function | Parameters |
|-----------|----------|------------|
| SMA | `sma(data, period)` | Simple Moving Average |
| EMA | `ema(data, period)` | Exponential Moving Average |
| RSI | `rsi(data, period=14)` | Relative Strength Index |
| MACD | `macd(data, fast=12, slow=26, signal=9)` | MACD line, signal, histogram |
| Bollinger Bands | `bollingerBands(data, period=20, stdDev=2)` | Upper, middle, lower bands |
| VWAP | `vwap(data)` | Volume-Weighted Average Price |
| ATR | `atr(data, period=14)` | Average True Range |
| Volume Spike | `volumeSpike(data, period=20)` | Volume vs average ratio |
| Price Change | `priceChangePercent(data, period)` | Percentage price change |

### Signal Components (signals.ts)

Each stock is scored on 8 weighted sub-signals:

| Signal | Weight | Bullish When | Bearish When |
|--------|--------|-------------|-------------|
| **RSI** | 15% | RSI < 35 (oversold) | RSI > 70 (overbought) |
| **MACD** | 15% | Histogram positive + rising | Histogram negative + falling |
| **Bollinger %B** | 12% | Price near lower band | Price near upper band |
| **Trend** | 18% | Price > SMA20 > SMA50, EMA9 above | Price < SMA20 < SMA50 |
| **Volume** | 10% | Volume spike > 1.5x average | Below average volume |
| **Momentum** | 12% | 5-day change > +2% | 5-day change < -2% |
| **VWAP** | 8% | Price above VWAP | Price below VWAP |
| **Support/Resistance** | 10% | Near support level | Near resistance level |

**Classification thresholds:**
- Composite ≥ 35 → `STRONG_BUY`
- Composite ≥ 15 → `BUY`
- Composite ≥ -10 → `HOLD`
- Below -10 → `SELL`

**Strategy assignment:**
- RSI < 35 + near Bollinger lower → `MEAN_REVERSION`
- Strong trend + momentum → `MOMENTUM`
- Default → `SWING`

### Risk Profiles

| Profile | Min Score | Min Confidence | Position Multiplier | Max Hold Days |
|---------|-----------|----------------|--------------------:|--------------|
| CONSERVATIVE | 30 | 60% | 0.6x | 15 days |
| MODERATE | 15 | 45% | 1.0x | 10 days |
| AGGRESSIVE | 8 | 30% | 1.4x | 7 days |

### Position Sizing (risk.ts)

1. **Base allocation**: `maxPositionPct` × risk profile multiplier
2. **Confidence scaling**: Blended signal confidence + AI confidence (for live)
3. **Risk cap**: Max 1% of portfolio risk per trade (based on stop-loss distance)
4. **Minimum**: $5 position size
5. **PDT compliance**: < 3 day trades in 5 days if portfolio < $25K (live only)
6. **Daily loss limit**: Stops trading if daily P&L exceeds `maxDailyLossPct`

### Exit Rules

| Condition | Action |
|-----------|--------|
| Price ≤ stop loss | Immediate exit |
| Price ≥ take profit | Immediate exit |
| Gain > 5% then price < entry × 1.01 | Trailing stop exit |
| Holding days ≥ max hold days | Time-based exit |

### Stop Loss & Take Profit Calculation
- **Stop loss**: `price - (ATR × 1.5)` (adjusted by risk profile `atrMultiplier`)
- **Take profit**: `price + (ATR × 1.5 × riskRewardRatio)` (risk/reward 1.5x–3x depending on profile)

---

## Rate Limiting

### Two-Layer Protection

**Layer 1 — Proxy (proxy.ts)**
- In-memory counter per user/IP
- Hourly limits: Anonymous 60, Free 120, Pro 600, Admin unlimited
- Returns HTTP 429 when exceeded

**Layer 2 — Database (rate-limit.ts)**
- Persistent counter in User model (`apiCallCount`, `apiCallWindow`)
- Applied to expensive routes (Claude analysis)
- If user exceeds 3× their hourly limit → **banned for 30 days**
- Admin receives email alert with ban details + SQL to unban

---

## Email System

- **Provider**: Porkbun SMTP (`smtp.porkbun.com:587`)
- **From address**: `hello@kosh.trade`
- **Env vars**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

### Email Triggers
| Event | Recipients | Template |
|-------|-----------|---------|
| New user signup | User + BCC admin | Welcome email with features overview |
| New signup (admin) | `shubhambalsaraf73@gmail.com` | Admin notification with user details |
| Trade executed | User | Trade confirmation (buy/sell) |
| Daily summary | User | Portfolio + P&L summary |
| User banned | Admin | Rate limit abuse alert |

---

## Authentication Flow

1. **Credentials**: Email + password → Argon2id hash → JWT session
2. **Google OAuth**: Google Provider → PrismaAdapter creates user → `createUser` event fires welcome email
3. **Session**: JWT-based (no DB sessions), refreshed on each request with DB lookup for tier/role/ban status
4. **Free tier**: 15 unique stock analyses tracked via `SearchHistory` distinct tickers

---

## Cron Jobs (Raspberry Pi)

```bash
# Trading cycle — every 15 min during US market hours (Mon-Fri)
*/15 9-15 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh cycle

# Last cycle at market close
0 16 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh cycle

# Daily summary at 4:30 PM ET
30 21 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh summary
```

The cron script POSTs to `/api/trading/auto` with `x-cron-secret` header. The API route iterates all users with `enabled: true` in their `TradingConfig`.

---

## External Data Sources

| Source | Usage | Auth | Free? |
|--------|-------|------|-------|
| Yahoo Finance (unofficial) | Live quotes, charts, historical data, news | None | Yes, unlimited |
| FMP (Financial Modeling Prep) | Fundamentals, ratios, income/balance/cash flow, earnings | API key | Paid (limited free) |
| Anthropic Claude | AI stock analysis, trading conviction scoring, briefings | API key | Paid per token |
| SEC EDGAR | Insider trading (Form 4 filings), ticker-CIK mapping | User-Agent | Yes, unlimited |
| Capitol Trades | Congressional trading data (scraped) | None | Yes (scraping) |
| Google News RSS | Stock news with images | None | Yes, unlimited |
| CNN Fear & Greed | Market sentiment index | None (scraped) | Yes |
| Alpaca | Paper + live trading execution | API key pair | Yes (paper free) |
| Parqet CDN | Stock logos/symbols | None | Yes, unlimited |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/kosh

# Auth
NEXTAUTH_SECRET=<random-string>
NEXTAUTH_URL=https://kosh.trade
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>

# AI
ANTHROPIC_API_KEY=<claude-api-key>

# Market Data
FMP_API_KEY=<fmp-api-key>

# Trading
ALPACA_API_KEY=<alpaca-key>
ALPACA_SECRET_KEY=<alpaca-secret>

# Email
SMTP_HOST=smtp.porkbun.com
SMTP_PORT=587
SMTP_USER=hello@kosh.trade
SMTP_PASS=<porkbun-email-password>

# Cron
CRON_SECRET=<random-secret-for-cron-auth>

# Payments
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe-publishable>
```

---

## Deployment (Raspberry Pi)

```bash
# Build and deploy
cd ~/kosh
git pull
npx prisma generate
npx prisma db push
npm run build
pm2 restart kosh

# Or first-time setup
npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 start npm --name kosh -- start
```

---

## LLM Context Prompt

If you need to hand this project to another LLM, use this prompt:

```
You are working on Kosh.trade, a Next.js 16 (App Router) full-stack application
for AI-powered stock analysis and automated trading. The codebase is in TypeScript.

Key systems:
1. STOCK ANALYSIS: Users search stocks → FMP API fetches fundamentals → Claude AI
   generates analysis with verdicts (CONSIDER/MODERATE/AVOID). Free users get 15
   unique analyses, Pro users unlimited.

2. KOSHPILOT (Auto-Trading): AI-powered trading system with paper and live modes.
   Pipeline: Yahoo charts → technical indicators (RSI, MACD, Bollinger, SMA/EMA,
   VWAP, volume, momentum, S/R) → weighted signal scoring → risk profile filtering
   → position sizing (1% max risk per trade) → Claude conviction scoring (live only,
   skip if < 4/10) → execute via Alpaca or DB (paper). Exits via stop loss, take
   profit, trailing stop (>5% gain), or max hold days.

3. DATABASE: PostgreSQL via Prisma. Models: User (with tier/role/ban), SearchHistory,
   Portfolio/Holdings/Trade, TradingConfig, AutoTrade, WatchlistItem, Alert, Account.

4. AUTH: NextAuth.js with JWT sessions, Google OAuth + email/password (Argon2id).
   Rate limiting via proxy.ts (in-memory) + DB-level for expensive routes.

5. EXTERNAL DATA: Yahoo Finance (free, charts/quotes/news), FMP (paid, fundamentals),
   SEC EDGAR (free, insider trades), Claude (paid, AI analysis), Alpaca (trading),
   Capitol Trades (congressional data, scraped).

6. DEPLOYMENT: Raspberry Pi, PM2, cron jobs for trading cycles during market hours.

The codebase is at /Users/shubhambalsaraf/new/kosh. Key directories:
- src/lib/trading/ — KoshPilot engine, signals, risk, executor
- src/app/api/ — All API routes
- src/app/(app)/ — Authenticated pages
- prisma/schema.prisma — Database schema
```
