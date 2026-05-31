#!/bin/bash
set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SKILL_DIR/config.json"
export SKILL_DIR

echo "📦 Installing $(python3 -c "import json; print(json.load(open('$CONFIG'))['tag'])")..."

if [ ! -f "$CONFIG" ]; then
  echo "❌ config.json not found at $CONFIG"
  exit 1
fi

# Step 1: Disable old jobs
echo "🔍 Checking for old jobs to disable..."
TAG=$(python3 -c "import json; print(json.load(open('$CONFIG'))['tag'])")
NAMES=$(python3 -c "
import json
with open('$CONFIG') as f:
    cfg = json.load(f)
for j in cfg['jobs']:
    print(j['name'])
")

OLD_IDS=$(openclaw cron list --json 2>/dev/null | python3 -c "
import sys, json
names = set('''$NAMES'''.strip().split('\n'))
data = json.loads(sys.stdin.read())
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
        "--json"
    ]
    
    if delivery.get("mode") == "announce":
        cmd.extend(["--announce"])
        if delivery.get("channel"):
            cmd.extend(["--channel", delivery["channel"]])
        if delivery.get("to"):
            cmd.extend(["--to", delivery["to"]])
    
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
python3 << 'PYEOF'
import subprocess, json, os

result = subprocess.run(["openclaw", "cron", "list", "--json"], capture_output=True, text=True)
data = json.loads(result.stdout)

config_path = os.environ["SKILL_DIR"] + "/config.json"
with open(config_path) as f:
    cfg = json.load(f)

expected_names = set(j["name"] for j in cfg["jobs"])
found = 0
for j in data.get("jobs", []):
    if j.get("name") in expected_names:
        status = "✅" if j.get("enabled") else "🔴 disabled"
        expr = j.get("schedule", {}).get("expr", "?")
        tz = j.get("schedule", {}).get("tz", "?")
        print(f'  {status} {j["name"]}: expr="{expr}" tz={tz} id={j.get("id","?")}')
        found += 1

if found == len(expected_names):
    print(f"\n🎉 All {found}/{len(expected_names)} jobs installed successfully!")
else:
    print(f"\n⚠️  Only {found}/{len(expected_names)} jobs found!")
PYEOF
