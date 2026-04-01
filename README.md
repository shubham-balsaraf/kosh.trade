# Kosh

A self-hosted trading intelligence platform that scans markets, identifies opportunities from multiple signal sources, and executes trades autonomously based on configurable risk profiles.

Built with Next.js, PostgreSQL, and deployed on a Raspberry Pi.

**Live at [kosh.trade](https://kosh.trade)**

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          kosh.trade (UI)                            │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│   │Dashboard │  │ Signals  │  │Portfolio │  │    KoshPilot      │  │
│   │          │  │          │  │          │  │  (Auto-Trading)   │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│        └──────────────┴─────────────┴─────────────────┘             │
│                               │                                     │
├───────────────────────────────┼─────────────────────────────────────┤
│                        API Layer (Next.js)                          │
│                               │                                     │
│   ┌───────────────────────────┼───────────────────────────────┐     │
│   │                           │                               │     │
│   │  ┌─────────────┐  ┌──────┴──────┐  ┌──────────────────┐  │     │
│   │  │  Signal      │  │  Trading    │  │  Stock Analysis  │  │     │
│   │  │  Discovery   │  │  Engine     │  │  & Research      │  │     │
│   │  └──────┬───────┘  └──────┬──────┘  └────────┬─────────┘  │     │
│   │         │                 │                   │            │     │
│   │  ┌──────┴───────┐  ┌─────┴───────┐  ┌───────┴────────┐   │     │
│   │  │  AI Analyst  │  │  Risk Mgmt  │  │  Technical     │   │     │
│   │  │  (Claude)    │  │  & Sizing   │  │  Scanner       │   │     │
│   │  └──────────────┘  └─────────────┘  └────────────────┘   │     │
│   │                                                           │     │
│   └───────────────────────────────────────────────────────────┘     │
│                               │                                     │
├───────────────────────────────┼─────────────────────────────────────┤
│                        Data Sources                                 │
│                               │                                     │
│   ┌──────────┐  ┌──────────┐  │  ┌──────────┐  ┌──────────────┐    │
│   │   FMP    │  │  Yahoo   │  │  │ Finnhub  │  │  Claude AI   │    │
│   │  API     │  │ Finance  │  │  │   API    │  │  (Anthropic) │    │
│   └──────────┘  └──────────┘  │  └──────────┘  └──────────────┘    │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Raspberry Pi        │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │  PostgreSQL     │  │
                    │  │  (Prisma ORM)   │  │
                    │  └─────────────────┘  │
                    │  ┌─────────────────┐  │
                    │  │  PM2 + Cron     │  │
                    │  │  (Auto Cycles)  │  │
                    │  └─────────────────┘  │
                    └───────────────────────┘
```

## Features

**KoshPilot — Autonomous Trading**
- Signal-first market scanning across news, insider trades, congressional activity, M&A, sector rotation, and market movers
- Technical analysis engine (RSI, MACD, Bollinger Bands, VWAP, volume, support/resistance)
- AI-powered conviction scoring and market narrative generation
- Risk-managed execution with stop-loss, take-profit, trailing stops, and position sizing
- Three risk profiles: Conservative, Moderate, Aggressive
- Cron-driven automation — runs on a schedule with zero human intervention

**Signals & Research**
- Market-wide signal intelligence with narrative synthesis
- Best-buy recommendations across short, medium, and long-term horizons
- Stock deep-dive with technicals, fundamentals, earnings, insider activity
- Congressional trade tracking
- Dip finder and fear/greed monitoring

**Portfolio Management**
- Multi-portfolio tracking with holdings and performance
- Live equity graph with real-time price updates
- AI-generated portfolio summaries

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS, Recharts |
| Backend | Next.js API Routes, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| AI | Claude (Anthropic SDK) |
| Market Data | FMP, Yahoo Finance, Finnhub |
| Auth | NextAuth.js, Argon2 |
| Payments | Stripe |
| Infra | Raspberry Pi, PM2, Cron |

## Setup

```bash
git clone https://github.com/shubham-balsaraf/kosh.git
cd kosh
npm install
cp .env.example .env   # configure your API keys
npx prisma db push
npm run dev
```

## License

Private — not open for redistribution.
