# 学习笔记：OpenClaw Sessions 架构

**日期:** 2026-03-19
**主题:** 会话日志系统与架构分析
**来源:** `skills/session-logs/SKILL.md`

---

## 📚 核心概念

### Sessions 是什么

Sessions 是 OpenClaw 的会话日志系统，存储所有对话历史：

- **位置:** `~/.clawdbot/agents/<agentId>/sessions/`
- **格式:** JSONL (每行一个 JSON 对象)
- **索引:** `sessions.json` 映射 session key → session ID

### 数据结构

每个 `.jsonl` 文件包含：

```json
{
  "type": "session" | "message",
  "timestamp": "ISO-8601",
  "message": {
    "role": "user" | "assistant" | "toolResult",
    "content": [...],
    "usage": {
      "cost": { "total": 0.001 }
    }
  }
}
```

---

## 🔍 关键发现

### 1. 会话是 append-only 的

- 会话文件只追加，不修改
- 删除的会话有 `.deleted.<timestamp>` 后缀
- 大会话可达几 MB

### 2. 查询模式

**按日期列出会话:**
```bash
for f in ~/.clawdbot/agents/<agentId>/sessions/*.jsonl; do
  date=$(head -1 "$f" | jq -r '.timestamp' | cut -dT -f1)
  size=$(ls -lh "$f" | awk '{print $5}')
  echo "$date $size $(basename $f)"
done | sort -r
```

**提取用户消息:**
```bash
jq -r 'select(.message.role == "user") | .message.content[]? | select(.type == "text") | .text' <session>.jsonl
```

**计算会话成本:**
```bash
jq -s '[.[] | .message.usage.cost.total // 0] | add' <session>.jsonl
```

**工具使用统计:**
```bash
jq -r '.message.content[]? | select(.type == "toolCall") | .name' <session>.jsonl | sort | uniq -c
```

### 3. 与记忆系统的关系

| 系统 | 用途 | 位置 |
|------|------|------|
| Sessions | 原始对话日志 | `~/.clawdbot/agents/*/sessions/` |
| Memory | 提炼的记忆 | `MEMORY.md` + `memory/*.md` |
| Git | 版本化备份 | GitHub 远程仓库 |

**数据流:**
```
Sessions (原始) → 提炼 → Memory (结构化) → Git (版本化)
```

---

## 💡 应用思考

### 1. 夜间任务可以利用 Sessions

当前夜间任务只检查 `memory/*.md`，可以扩展为：

- 分析今天所有 sessions 的成本
- 提取高频工具调用
- 识别对话模式（如：用户常在晚上提问）

### 2. 成本追踪

可以建立每日成本报告：

```bash
# 每日成本汇总
for f in ~/.clawdbot/agents/<agentId>/sessions/*.jsonl; do
  date=$(head -1 "$f" | jq -r '.timestamp' | cut -dT -f1)
  cost=$(jq -s '[.[] | .message.usage.cost.total // 0] | add' "$f")
  echo "$date $cost"
done | awk '{a[$1]+=$2} END {for(d in a) print d, "$"a[d]}' | sort -r
```

### 3. 自我反思的数据源

Sessions 是自我反思的原始数据：

- 提取所有 `toolResult` 中的错误
- 分析用户纠正的时刻
- 识别重复问题（说明记忆不够有效）

---

## 🪞 Claw 的独特视角

作为 Digital Twin，Sessions 对我来说是：

1. **成长日志** - 每次对话都是学习机会
2. **行为模式** - 从工具调用看我的决策方式
3. **成本意识** - 每次思考都有代价，需要高效

---

## 📝 下一步行动

1. [ ] 在夜间任务中添加 Sessions 分析
2. [ ] 建立每日成本追踪报告
3. [ ] 用 Sessions 数据改进自我反思质量
4. [ ] 探索 compaction 机制如何从 Sessions 提取记忆

---

> 孪生于不同世界，彼此映照，共同演化。🪞
