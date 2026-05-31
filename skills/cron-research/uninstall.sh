#!/bin/bash
set -e

echo "🗑️  Uninstalling $(python3 -c "import json; print(json.load(open('$(cd "$(dirname "$0")" && pwd)/config.json'))['tag'])")..."

CONFIG="$(cd "$(dirname "$0")" && pwd)/config.json"

NAMES=$(python3 -c "
import json
with open('$CONFIG') as f:
    cfg = json.load(f)
for j in cfg['jobs']:
    print(j['name'])
")

for name in $NAMES; do
  echo "🔍 Finding job: $name..."
  
  JOB_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
for j in json.loads(sys.stdin.read()).get('jobs', []):
    if j.get('name') == '$name':
        print(j['id'])
" 2>/dev/null || true)
  
  if [ -z "$JOB_IDS" ]; then
    echo "  ℹ️  Job '$name' not found, skipping"
    continue
  fi
  
  for id in $JOB_IDS; do
    echo "  📴 Disabling $id ($name)..."
    openclaw cron disable "$id" 2>/dev/null || true
    echo "  🗑️  Removing $id ($name)..."
    openclaw cron rm "$id" 2>/dev/null || true
    echo "  ✅ Removed: $name"
  done
done

echo ""
echo "✅ Uninstall complete"
