#!/bin/bash
set -e

TAG="cron-reports"

echo "🗑️  Uninstalling $TAG..."

# Disable and remove jobs with matching names
NAMES="晨间报告 午间报告 晚间报告"

for name in $NAMES; do
  echo "🔍 Finding job: $name..."
  
  JOB_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
for j in data.get('jobs', []):
    if j.get('name') == '$name':
        print(j['id'])
" 2>/dev/null || true)
  
  if [ -z "$JOB_IDS" ]; then
    echo "  ℹ️  Job '$name' not found, skipping"
    continue
  fi
  
  for id in $JOB_IDS; do
    echo "  📴 Disabling job $id ($name)..."
    openclaw cron disable "$id" 2>/dev/null || true
    echo "  🗑️  Removing job $id ($name)..."
    openclaw cron rm "$id" 2>/dev/null || true
    echo "  ✅ Removed: $name"
  done
done

echo ""
echo "🔍 Verifying removal..."
openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
names = set(['晨间报告', '午间报告', '晚间报告'])
remaining = [j['name'] for j in data.get('jobs', []) if j.get('name') in names]
if remaining:
    print(f'⚠️  Still found: {remaining}')
else:
    print('✅ All cron-reports jobs removed')
"
