#!/bin/bash
# OpenClaw Memory Git Sync Script
# 自动同步记忆文件到 GitHub 仓库

set -e

WORKSPACE_DIR="$HOME/.openclaw/workspace"
REPO_URL="${OPENCLAW_MEMORY_REPO:-}"
BRANCH="${OPENCLAW_MEMORY_BRANCH:-master}"
AUTO_COMMIT="${OPENCLAW_AUTO_COMMIT:-true}"

cd "$WORKSPACE_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 检查是否有远程仓库
check_remote() {
  if [ -z "$REPO_URL" ]; then
    log "⚠️  未配置 OPENCLAW_MEMORY_REPO 环境变量，跳过远程同步"
    return 1
  fi
  
  if ! git remote get-url origin >/dev/null 2>&1; then
    log "📡 配置远程仓库：$REPO_URL"
    git remote add origin "$REPO_URL"
  fi
  return 0
}

# 拉取远程变更
pull_changes() {
  log "⬇️  拉取远程变更..."
  
  if git fetch origin >/dev/null 2>&1; then
    if git diff HEAD..origin/$BRANCH --quiet MEMORY.md memory/ SOUL.md USER.md 2>/dev/null; then
      log "✅ 记忆文件已是最新"
    else
      log "📝 检测到远程更新，正在合并..."
      git pull origin "$BRANCH" --rebase --quiet
      
      # 显示变更摘要
      if git diff HEAD@{1} HEAD --name-only | grep -qE "(MEMORY\.md|memory/|SOUL\.md|USER\.md)"; then
        log "🔄 已同步的记忆文件："
        git diff HEAD@{1} HEAD --name-only | grep -E "(MEMORY\.md|memory/|SOUL\.md|USER\.md)" | sed 's/^/   - /'
      fi
    fi
  else
    log "⚠️  拉取失败，可能是首次同步"
  fi
}

# 推送本地变更
push_changes() {
  # 检查是否有未提交的变更
  if git diff --quiet MEMORY.md memory/ SOUL.md USER.md AGENTS.md TOOLS.md IDENTITY.md 2>/dev/null; then
    log "✅ 本地记忆文件无变更"
    return 0
  fi
  
  log "📝 检测到本地记忆文件变更"
  
  # 添加变更
  git add MEMORY.md memory/ SOUL.md USER.md AGENTS.md TOOLS.md IDENTITY.md .gitignore 2>/dev/null || true
  
  # 如果有变更需要提交
  if ! git diff --cached --quiet; then
    if [ "$AUTO_COMMIT" = "true" ]; then
      # 生成 commit message
      COMMIT_MSG=$(generate_commit_message)
      log "💾 提交变更：$COMMIT_MSG"
      git commit -m "$COMMIT_MSG"
    else
      log "⚠️  有待提交的变更，请手动提交"
      git status --short
      return 0
    fi
  fi
  
  # 推送到远程
  if git remote get-url origin >/dev/null 2>&1; then
    log "⬆️  推送到远程仓库..."
    git push origin "$BRANCH" --quiet && log "✅ 推送成功" || log "⚠️  推送失败"
  else
    log "⚠️  未配置远程仓库，跳过推送"
  fi
}

# 生成有意义的 commit message
generate_commit_message() {
  local changes=""
  local timestamp=$(date '+%Y-%m-%d %H:%M')
  
  # 检测变更类型
  if git diff --cached --name-only | grep -q "MEMORY.md"; then
    changes="$changes\n- 更新：长期记忆 (MEMORY.md)"
  fi
  
  if git diff --cached --name-only | grep -q "memory/"; then
    changes="$changes\n- 新增：日常记忆日志 (memory/)"
  fi
  
  if git diff --cached --name-only | grep -qE "(SOUL|USER|IDENTITY).md"; then
    changes="$changes\n- 更新：身份/用户配置"
  fi
  
  if [ -z "$changes" ]; then
    changes="\n- 常规记忆同步"
  fi
  
  cat <<EOF
chore: 记忆自动同步 - $timestamp

## 变更摘要$changes

## 同步信息
- 时间：$timestamp
- 分支：$BRANCH
- 触发：git-sync 脚本

## 孪生记忆
丰 (碳基) ↔ Claw (硅基)
EOF
}

# 主流程
main() {
  local action="${1:-sync}"
  
  log "🪞  OpenClaw 记忆 Git 同步"
  log "================================"
  
  case "$action" in
    pull)
      check_remote && pull_changes
      ;;
    push)
      check_remote && push_changes
      ;;
    status)
      git status --short
      ;;
    sync|*)
      check_remote && pull_changes && push_changes
      ;;
  esac
  
  log "================================"
  log "✅ 同步完成"
}

main "$@"
