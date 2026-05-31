#!/bin/bash
set -e

echo "🗑️  Uninstalling cron-nightly..."

CONFIG="$(cd "$(dirname "$0")" && pwd)/config.json"
NAME="脚本执行-夜间"

JOB_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
for j in json.loads(sys.stdin.read()).get('jobs', []):
    if j.get('name') == '$NAME':
        print(j['id'])
" 2>/dev/null || true)

if [ -z "$JOB_IDS" ]; then
  echo "  ℹ️  No jobs found"
  exit 0
fi

for id in $JOB_IDS; do
  echo "  📴 Disabling $id..."
  openclaw cron disable "$id" 2>/dev/null || true
  echo "  🗑️  Removing $id..."
  openclaw cron rm "$id" 2>/dev/null || true
done

echo "✅ Done"
