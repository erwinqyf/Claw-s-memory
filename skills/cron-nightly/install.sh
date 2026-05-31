#!/bin/bash
set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SKILL_DIR/config.json"
export SKILL_DIR

echo "📦 Installing cron-nightly..."

if [ ! -f "$CONFIG" ]; then
  echo "❌ config.json not found"
  exit 1
fi

# Disable old
OLD_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
names = {'脚本执行-夜间'}
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

echo "📝 Creating job..."
openclaw cron add \
  --name "脚本执行-夜间" \
  --cron "0 0 * * *" \
  --tz "Asia/Shanghai" \
  --session isolated \
  --message "🔧 Engineer 执行夜间脚本：
1. bash scripts/git-sync.sh sync（Git 同步）
2. 检查 memory/ 是否有今日文件，缺失则创建
3. 检查 scripts/ 目录，列出一个最需要优化的脚本（只读不修改）
4. 将结果写入 data/exec-results/night-\${date}.json

报告每个命令的执行结果（成功/失败/原因）。" \
  --model "bailian-coding-plan/qwen3.6-plus" \
  --timeout-seconds 180 \
  --json 2>&1

echo "✅ Done. Verify with: openclaw cron list"
