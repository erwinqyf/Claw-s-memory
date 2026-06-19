#!/bin/bash
cd /home/admin/.openclaw/workspace

# Auto-commit changes
git add -A
git diff --staged --quiet && echo "Nothing to commit" && exit 0

git commit -m "chore: 记忆自动同步 - $(date +%Y-%m-%d" "%H:%M)"
git push
