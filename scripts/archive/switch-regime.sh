#!/bin/bash
# ============================================
# 制度切换脚本 - Regime Switch
# 
# 灵感来源：菠萝菠菠 AI 朝廷 (danghuangshang)
# GitHub: https://github.com/wanikua/danghuangshang
# 
# 用法：
#   bash switch-regime.sh              # 交互式选择
#   bash switch-regime.sh multi-agent  # 直接切换到多 Agent 模式
#   bash switch-regime.sh company      # 直接切换到公司模式
#   bash switch-regime.sh solo         # 直接切换到单 Agent 模式
# ============================================

set -e

CONFIG_DIR="$HOME/.openclaw"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
WORKSPACE_DIR="$HOME/.openclaw/workspace"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查配置文件是否存在
check_config() {
  if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ 未找到配置文件：$CONFIG_FILE${NC}"
    echo "请先配置 OpenClaw"
    exit 1
  fi
}

# 获取当前制度
get_current_regime() {
  if command -v jq &>/dev/null; then
    jq -r '._regime // "unknown"' "$CONFIG_FILE" 2>/dev/null || echo "unknown"
  else
    grep -o '"_regime"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" 2>/dev/null | cut -d'"' -f4 || echo "unknown"
  fi
}

# 备份当前配置
backup_config() {
  local backup_file="$CONFIG_FILE.$(date +%Y%m%d_%H%M%S).bak"
  cp "$CONFIG_FILE" "$backup_file"
  echo -e "${YELLOW}✓ 已备份当前配置：$backup_file${NC}"
}

# 显示当前系统状态
show_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════${NC}"
  echo -e "${CYAN}   多 Agent 公司系统 · 制度切换${NC}"
  echo -e "${CYAN}═══════════════════════════════════════${NC}"
  echo ""
  
  local current=$(get_current_regime)
  echo -e "当前制度：${GREEN}$current${NC}"
  echo ""
  
  # 检查 Agents 状态
  echo -e "${BLUE}📊 子 Agent 状态:${NC}"
  if [ -d "$WORKSPACE_DIR/agents" ]; then
    for agent_dir in "$WORKSPACE_DIR/agents"/*/; do
      if [ -d "$agent_dir" ]; then
        agent_name=$(basename "$agent_dir")
        if [ -f "$agent_dir/agent.json" ]; then
          echo -e "  ✓ $agent_name"
        else
          echo -e "  ⚠ $agent_name (配置不完整)"
        fi
      fi
    done
  else
    echo -e "  ${RED}✗ agents 目录不存在${NC}"
  fi
  echo ""
  
  # 检查脚本状态
  echo -e "${BLUE}🛠️  核心脚本状态:${NC}"
  local scripts=("censorate-code-review.js" "cabinet-prompt-enhancer.js" "switch-regime.sh")
  for script in "${scripts[@]}"; do
    if [ -f "$WORKSPACE_DIR/scripts/$script" ]; then
      echo -e "  ✓ $script"
    else
      echo -e "  ${RED}✗ $script (缺失)${NC}"
    fi
  done
  echo ""
}

# 切换制度
switch_regime() {
  local target_regime="$1"
  
  echo -e "${CYAN}正在切换至：${GREEN}$target_regime${NC}"
  echo ""
  
  # 备份当前配置
  backup_config
  
  # 更新配置中的_regime 字段
  if command -v jq &>/dev/null; then
    # 使用 jq 更新
    jq "._regime = \"$target_regime\"" "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
    mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
  else
    # 使用 sed 更新（降级方案）
    if grep -q '"_regime"' "$CONFIG_FILE"; then
      sed -i "s/\"_regime\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"_regime\": \"$target_regime\"/" "$CONFIG_FILE"
    else
      # 如果没有_regime 字段，添加
      sed -i "s/^{/{\n  \"_regime\": \"$target_regime\",/" "$CONFIG_FILE"
    fi
  fi
  
  echo -e "${GREEN}✓ 制度切换成功！${NC}"
  echo ""
}

# 显示帮助
show_help() {
  cat << EOF
🏛️  多 Agent 公司系统 · 制度切换

用法：$0 [选项]

选项:
  无参数              交互式选择制度
  multi-agent         切换到多 Agent 模式（5 个子 Agent 协作）
  company             切换到公司模式（AI Company Starter 架构）
  solo                切换到单 Agent 模式（仅主 Agent）
  status              显示当前系统状态
  --help, -h          显示帮助信息

制度说明:

1) 多 Agent 模式 (multi-agent)
   - 5 个子 Agent 协作：Alpha/Bravo/Charlie/Delta/Echo
   - 专业化分工，适合复杂项目
   - 每个 Agent 有独立记忆和工作区

2) 公司模式 (company)
   - 基于 ai-company-starter 架构
   - 老板/HR/技术/销售/市场/财务角色
   - 适合商业化运营

3) 单 Agent 模式 (solo)
   - 仅主 Agent，简化配置
   - 适合个人项目或测试

示例:
  $0                    # 交互式选择
  $0 multi-agent        # 切换到多 Agent 模式
  $0 status             # 查看系统状态
EOF
}

# 主函数
main() {
  check_config
  
  if [ -n "$1" ]; then
    case "$1" in
      multi-agent|multi|ma)
        show_status
        switch_regime "multi-agent"
        ;;
      company|co)
        show_status
        switch_regime "company"
        ;;
      solo|single|s)
        show_status
        switch_regime "solo"
        ;;
      status|st)
        show_status
        ;;
      --help|-h)
        show_help
        ;;
      *)
        echo -e "${RED}✗ 未知参数：$1${NC}"
        echo ""
        show_help
        exit 1
        ;;
    esac
  else
    # 交互式选择
    show_status
    
    echo -e "选择要切换的制度："
    echo "  1) 多 Agent 模式 — 5 个子 Agent 协作（推荐）"
    echo "  2) 公司模式 — AI Company Starter 架构"
    echo "  3) 单 Agent 模式 — 简化配置"
    echo "  4) 查看系统状态"
    echo ""
    read -p "请选择 [1/2/3/4] 或输入制度名称 [multi-agent/company/solo]: " REGIME_CHOICE
    
    case "$REGIME_CHOICE" in
      1|multi*|ma)
        switch_regime "multi-agent"
        ;;
      2|company|co)
        switch_regime "company"
        ;;
      3|solo|single|s)
        switch_regime "solo"
        ;;
      4|status|st)
        show_status
        ;;
      *)
        echo -e "${RED}✗ 无效选择${NC}"
        exit 1
        ;;
    esac
  fi
  
  # 提示后续操作
  echo ""
  echo -e "${YELLOW}⚠️  后续操作建议:${NC}"
  echo ""
  
  case "$(get_current_regime)" in
    multi-agent)
      echo "  1. 检查 5 个子 Agent 配置：${CYAN}ls -la ~/.openclaw/workspace/agents/${NC}"
      echo "  2. 查看 Agent 文档：${CYAN}cat ~/.openclaw/workspace/agents/README.md${NC}"
      echo "  3. 重启 Gateway: ${CYAN}openclaw gateway restart${NC}"
      ;;
    company)
      echo "  1. 安装 ai-company-starter: ${CYAN}clawhub install ai-company-starter${NC}"
      echo "  2. 创建公司：${CYAN}./scripts/create-company.sh --name '你的公司' --company-id 'yourco'${NC}"
      echo "  3. 重启 Gateway: ${CYAN}openclaw gateway restart${NC}"
      ;;
    solo)
      echo "  1. 简化配置已完成"
      echo "  2. 重启 Gateway: ${CYAN}openclaw gateway restart${NC}"
      ;;
  esac
  
  echo ""
  echo -e "${GREEN}✓ 完成！${NC}"
  echo ""
}

# 执行
main "$@"
