#!/bin/bash
# Kosh AutoTrader Cron Script
# Runs trading cycles for all enabled users (buy + sell checks)
#
# ── Setup on Raspberry Pi ──
#
# 1. SSH into your Pi:
#      ssh ubuntu@<pi-ip>
#
# 2. Add CRON_SECRET to the environment:
#      echo 'export CRON_SECRET="your-secret-here"' >> ~/.bashrc
#      source ~/.bashrc
#
# 3. Make this script executable:
#      chmod +x ~/kosh/scripts/cron-trading.sh
#
# 4. Add to crontab:
#      crontab -e
#
#   Every 15 min during US market hours (9:30 AM - 4:00 PM ET):
#     */15 9-15 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh cycle >> /home/ubuntu/kosh/logs/trading.log 2>&1
#     0 16 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh cycle >> /home/ubuntu/kosh/logs/trading.log 2>&1
#
#   Daily summary (4:30 PM ET):
#     30 16 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh summary >> /home/ubuntu/kosh/logs/trading.log 2>&1
#
# 5. Create log directory:
#      mkdir -p ~/kosh/logs
#
# 6. Verify cron is running:
#      crontab -l
#      tail -f ~/kosh/logs/trading.log
#

set -e

KOSH_URL="${KOSH_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-$(grep CRON_SECRET ~/kosh/.env 2>/dev/null | cut -d= -f2)}"
ACTION="${1:-cycle}"
LOG_PREFIX="[$(date -u +%Y-%m-%dT%H:%M:%SZ)]"

if [ -z "$CRON_SECRET" ]; then
  echo "$LOG_PREFIX ERROR: CRON_SECRET not set. Export it or add to ~/kosh/.env"
  exit 1
fi

echo "$LOG_PREFIX ▶ Running trading $ACTION against $KOSH_URL"

case "$ACTION" in
  cycle)
    RESPONSE=$(curl -sS --max-time 120 -w "\n%{http_code}" -X POST "$KOSH_URL/api/trading/auto" \
      -H "Content-Type: application/json" \
      -H "x-cron-secret: $CRON_SECRET" \
      -d '{}')
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    echo "$LOG_PREFIX   Status: $HTTP_CODE"
    echo "$LOG_PREFIX   Response: $BODY"
    if [ "$HTTP_CODE" != "200" ]; then
      echo "$LOG_PREFIX ✗ Cycle failed with HTTP $HTTP_CODE"
      exit 1
    fi
    echo "$LOG_PREFIX ✓ Cycle complete"
    ;;
  summary)
    curl -sS --max-time 60 -X POST "$KOSH_URL/api/trading/auto?action=summary" \
      -H "Content-Type: application/json" \
      -H "x-cron-secret: $CRON_SECRET" \
      -d '{}'
    echo ""
    echo "$LOG_PREFIX ✓ Summary sent"
    ;;
  *)
    echo "Usage: $0 {cycle|summary}"
    exit 1
    ;;
esac

echo "$LOG_PREFIX ■ Done"
