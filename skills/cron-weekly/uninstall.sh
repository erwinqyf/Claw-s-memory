#!/bin/bash
set -e

echo "🗑️  Uninstalling cron-weekly..."

CONFIG="$(cd "$(dirname "$0")" && pwd)/config.json"
NAMES="周报复盘 脚本执行-小红书周报 每周记忆巩固"

for name in $NAMES; do
  echo "🔍 Finding: $name..."
  JOB_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
for j in json.loads(sys.stdin.read()).get('jobs', []):
    if j.get('name') == '$name':
        print(j['id'])
" 2>/dev/null || true)
  
  if [ -z "$JOB_IDS" ]; then
    echo "  ℹ️  Not found"
    continue
  fi
  
  for id in $JOB_IDS; do
    openclaw cron disable "$id" 2>/dev/null || true
    openclaw cron rm "$id" 2>/dev/null || true
    echo "  ✅ Removed: $name"
  done
done

echo "✅ Done"
