#!/bin/bash
set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SKILL_DIR/config.json"
export SKILL_DIR

echo "📦 Installing cron-weekly..."

if [ ! -f "$CONFIG" ]; then
  echo "❌ config.json not found"
  exit 1
fi

# Disable old
OLD_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
names = {'周报复盘', '脚本执行-小红书周报', '每周记忆巩固'}
for j in json.loads(sys.stdin.read()).get('jobs', []):
    if j.get('name') in names and j.get('enabled', True):
        print(j['id'])
" 2>/dev/null || true)

if [ -n "$OLD_IDS" ]; then
  for id in $OLD_IDS; do
    echo "  📴 Disabling $id..."
    openclaw cron disable "$id" 2>/dev/null || true
  done
fi

echo "📝 Creating jobs..."
echo "  (Use cron tool directly — CLI timeout workaround)"
echo "  See SKILL.md for manual creation commands"
