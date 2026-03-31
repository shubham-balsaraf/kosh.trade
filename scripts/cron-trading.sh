#!/bin/bash
# Kosh AutoTrader Cron Script
# Runs trading cycles for all enabled users
#
# Add to crontab on your Pi:
#   crontab -e
#
# Every 15 min during US market hours (9:30 AM - 4:00 PM ET = 14:30-21:00 UTC):
#   */15 9-15 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh cycle >> /home/ubuntu/kosh/logs/trading.log 2>&1
#   0 16 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh cycle >> /home/ubuntu/kosh/logs/trading.log 2>&1
#
# Daily pre-market briefing (9:00 AM ET = 14:00 UTC):
#   0 14 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh briefing >> /home/ubuntu/kosh/logs/trading.log 2>&1
#
# Daily summary (4:30 PM ET = 21:30 UTC):
#   30 21 * * 1-5 /home/ubuntu/kosh/scripts/cron-trading.sh summary >> /home/ubuntu/kosh/logs/trading.log 2>&1

set -e

KOSH_URL="${KOSH_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-$(grep CRON_SECRET ~/kosh/.env 2>/dev/null | cut -d= -f2)}"
ACTION="${1:-cycle}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Running trading $ACTION"

case "$ACTION" in
  cycle)
    curl -s -X POST "$KOSH_URL/api/trading/auto" \
      -H "Content-Type: application/json" \
      -H "x-cron-secret: $CRON_SECRET" \
      -d '{}'
    ;;
  summary)
    curl -s -X POST "$KOSH_URL/api/trading/auto?action=summary" \
      -H "Content-Type: application/json" \
      -H "x-cron-secret: $CRON_SECRET" \
      -d '{}'
    ;;
  *)
    echo "Usage: $0 {cycle|summary}"
    exit 1
    ;;
esac

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Done"
