#!/bin/bash
set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SKILL_DIR/config.json"
TAG="cron-reports"

echo "📦 Installing $TAG..."

if [ ! -f "$CONFIG" ]; then
  echo "❌ config.json not found at $CONFIG"
  exit 1
fi

# Step 1: Disable old jobs with matching names
echo "🔍 Checking for old jobs to disable..."
OLD_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
names = ['晨间报告', '午间报告', '晚间报告']
for j in data.get('jobs', []):
    if j.get('name') in names and j.get('enabled', True):
        print(j['id'])
" 2>/dev/null || true)

if [ -n "$OLD_IDS" ]; then
  for id in $OLD_IDS; do
    echo "  📴 Disabling old job $id..."
    openclaw cron disable "$id" 2>/dev/null || true
  done
  echo "  ✅ Old jobs disabled"
else
  echo "  ℹ️  No old jobs found to disable"
fi

# Step 2: Create new jobs
echo "📝 Creating new cron jobs..."

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
export SKILL_DIR

python3 << 'PYEOF'
import json, subprocess, sys, os

config_path = os.environ["SKILL_DIR"] + "/config.json"
with open(config_path) as f:
    cfg = json.load(f)

for job in cfg["jobs"]:
    name = job["name"]
    sched = job["schedule"]
    payload = job["payload"]
    delivery = job.get("delivery", {})
    
    print(f"  ➕ Creating: {name}")
    
    cmd = [
        "openclaw", "cron", "add",
        "--name", name,
        "--cron", sched["expr"],
        "--tz", sched.get("tz", "Asia/Shanghai"),
        "--session", job.get("sessionTarget", "isolated"),
        "--message", payload["message"],
        "--model", payload.get("model", ""),
        "--timeout-seconds", str(payload.get("timeoutSeconds", 300)),
        "--announce",
        "--channel", delivery.get("channel", "feishu"),
        "--to", delivery.get("to", "user:ou_adcbc44a6fb7460391e585338f9e1e35"),
        "--json"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ❌ Failed to create {name}: {result.stderr}")
        sys.exit(1)
    
    try:
        resp = json.loads(result.stdout)
        job_id = resp.get("id", "?")
        print(f"  ✅ Created: {name} (id: {job_id})")
    except:
        print(f"  ✅ Created: {name}")

PYEOF

# Step 3: Verify
echo ""
echo "🔍 Verifying installation..."
openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
data = json.loads(sys.stdin.read())
names = ['晨间报告', '午间报告', '晚间报告']
found = 0
for j in data.get('jobs', []):
    if j.get('name') in names:
        status = '✅' if j.get('enabled') else '🔴 disabled'
        expr = j.get('schedule', {}).get('expr', '?')
        tz = j.get('schedule', {}).get('tz', '?')
        print(f'  {status} {j[\"name\"]}: expr=\"{expr}\" tz={tz} id={j.get(\"id\",\"?\")}')
        found += 1
if found == 3:
    print()
    print('🎉 All 3 report jobs installed successfully!')
else:
    print()
    print(f'⚠️  Only {found}/3 jobs found!')
"
