#!/bin/bash
# AI HOT Daily Report - Fetch and Send Script
# 每天早上8点执行，获取AI HOT日报并通过飞书发送

set -e

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 获取日报数据
fetch_daily() {
    local date_str=$1
    curl -sH "User-Agent: $UA" "https://aihot.virxact.com/api/public/daily/${date_str}" 2>/dev/null || echo ""
}

# 获取今日或昨日日报
get_report_data() {
    local today=$(date +%Y-%m-%d)
    local data=$(fetch_daily "$today")
    
    # 如果今天日报还没生成，获取昨天的
    if [ -z "$data" ] || [ "$data" = "" ] || echo "$data" | grep -q "No daily report"; then
        local yesterday=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null)
        data=$(fetch_daily "$yesterday")
        echo "$data|yesterday"
    else
        echo "$data|today"
    fi
}

# 格式化报告
format_report() {
    local data=$1
    local is_yesterday=$2
    
    local date=$(echo "$data" | jq -r '.date // "未知日期"')
    local date_label=$date
    [ "$is_yesterday" = "true" ] && date_label="${date}（昨日）"
    
    cat << EOF
## 🤖 AI HOT 日报 · ${date_label}

EOF
    
    # 主编点评
    local lead_title=$(echo "$data" | jq -r '.lead.title // empty')
    local lead_para=$(echo "$data" | jq -r '.lead.leadParagraph // empty')
    
    if [ -n "$lead_title" ]; then
        cat << EOF
### 📌 主编点评
**${lead_title}**

${lead_para}

EOF
    fi
    
    # 各版块内容
    local sections=$(echo "$data" | jq -c '.sections // []')
    local item_num=1
    
    echo "$sections" | jq -c '.[]' 2>/dev/null | while read -r section; do
        local label=$(echo "$section" | jq -r '.label // empty')
        local items=$(echo "$section" | jq -c '.items // []')
        
        if [ -n "$label" ] && [ "$items" != "[]" ]; then
            echo "### ${label}"
            echo ""
            
            echo "$items" | jq -c '.[]' 2>/dev/null | while read -r item; do
                local title=$(echo "$item" | jq -r '.title // "无标题"')
                local source=$(echo "$item" | jq -r '.sourceName // .source // "未知来源"')
                local url=$(echo "$item" | jq -r '.sourceUrl // .url // empty')
                local summary=$(echo "$item" | jq -r '.summary // empty')
                
                # 截断摘要
                if [ -n "$summary" ]; then
                    summary=$(echo "$summary" | cut -c1-80)
                    [ ${#summary} -ge 80 ] && summary="${summary}..."
                fi
                
                echo "${item_num}. **${title}** — ${source}"
                [ -n "$summary" ] && echo "   ${summary}"
                [ -n "$url" ] && echo "   ${url}"
                echo ""
                
                item_num=$((item_num + 1))
            done
        fi
    done
    
    # 快讯
    local flashes=$(echo "$data" | jq -c '.flashes // []')
    if [ "$flashes" != "[]" ]; then
        echo "### ⚡ 快讯"
        echo ""
        echo "$flashes" | jq -r '.[] | "- \(.title // "无标题") — \(.sourceName // "未知来源")"' 2>/dev/null | head -5
        echo ""
    fi
    
    cat << EOF
---
📊 数据来自 [AI HOT](https://aihot.virxact.com)
EOF
}

# 主逻辑
main() {
    echo "🤖 正在获取 AI HOT 日报..."
    
    result=$(get_report_data)
    data=$(echo "$result" | cut -d'|' -f1)
    day_flag=$(echo "$result" | cut -d'|' -f2)
    
    if [ -z "$data" ] || [ "$data" = "" ]; then
        echo "❌ 获取日报失败"
        exit 1
    fi
    
    is_yesterday="false"
    [ "$day_flag" = "yesterday" ] && is_yesterday="true"
    
    report=$(format_report "$data" "$is_yesterday")
    echo "$report"
}

main "$@"
