# OpenClaw Sessions 架构深度研究

**研究日期：** 2026-04-09  
**研究时长：** 30 分钟  
**来源：** session-logs SKILL.md、系统实践

---

## 核心发现

### 1. Sessions 的本质

Sessions 是 OpenClaw 的**原始对话日志**，采用 append-only JSONL 格式存储：

```
~/.clawdbot/agents/<agentId>/sessions/
├── sessions.json           # 索引：session key → session ID 映射
└── <session-id>.jsonl      # 完整对话记录
```

### 2. 数据流架构

```
Sessions (原始层)
    ↓
Memory (提炼层) - memory/*.md, MEMORY.md
    ↓
Git (版本化层) - GitHub 远程仓库
```

**关键洞察：**
- Sessions 是**机器友好的**（JSONL，结构化）
- Memory 是**人类友好的**（Markdown，可读）
- Git 是**持久化的**（版本化、可回溯）

### 3. JSONL 结构解析

每条消息包含：

```json
{
  "type": "message",
  "timestamp": "2026-04-09T00:00:00.000Z",
  "message": {
    "role": "user" | "assistant" | "toolResult",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "toolCall", "name": "web_search", ... },
      { "type": "thinking", "thinking": "..." }
    ],
    "usage": {
      "cost": { "total": 0.00123 }
    }
  }
}
```

### 4. Sessions 的应用场景

| 场景 | 查询示例 | 价值 |
|------|---------|------|
| 成本追踪 | `jq -s '[.[] | .message.usage.cost.total // 0] \| add'` | 精确到会话的花费 |
| 工具分析 | `jq -r '.message.content[]? \| select(.type == "toolCall") \| .name'` | 使用频率统计 |
| 关键词搜索 | `rg -i "keyword" ~/.clawdbot/agents/*/sessions/*.jsonl` | 跨会话检索 |
| 行为模式 | 分析 user/assistant 消息比例 | 交互质量评估 |

### 5. 与 Memory 的对比

| 维度 | Sessions | Memory |
|------|----------|--------|
| 格式 | JSONL (结构化) | Markdown (可读) |
| 更新方式 | Append-only | 可编辑 |
| 存储位置 | `~/.clawdbot` | `~/workspace/memory/` |
| 主要用途 | 分析、审计、回溯 | 日常参考、长期记忆 |
| 生命周期 | 永久保留 | 定期整理 |
| 检索方式 | jq、rg | memory_search、手动阅读 |

### 6. 实践建议

**夜间任务可添加的 Sessions 分析模块：**

1. **每日成本报告**
   ```bash
   # 统计昨日所有会话成本
   for f in ~/.clawdbot/agents/*/sessions/*.jsonl; do
     date=$(head -1 "$f" | jq -r '.timestamp' | cut -dT -f1)
     cost=$(jq -s '[.[] | .message.usage.cost.total // 0] | add' "$f")
     echo "$date $cost"
   done | awk '{a[$1]+=$2} END {for(d in a) print d, "$"a[d]}' | sort -r
   ```

2. **工具使用分析**
   ```bash
   # 统计最常用工具
   jq -r '.message.content[]? | select(.type == "toolCall") | .name' ~/.clawdbot/agents/*/sessions/*.jsonl | sort | uniq -c | sort -rn
   ```

3. **异常检测**
   - 单会话成本异常高（> $1）
   - 工具调用失败率统计
   - 响应时间过长检测

### 7. Sessions 与 Compaction

OpenClaw 的 compaction 机制：
- 定期压缩 Sessions → Memory
- 提取关键信息写入 memory/*.md
- 保留原始 Sessions 用于审计

**关键问题：** Sessions 是否会被删除？
- 默认：永久保留
- 删除的会话：`.deleted.<timestamp>` 后缀

---

## 学习总结

**核心收获：**
1. Sessions 是 OpenClaw 的"黑匣子"，记录一切
2. 与 Memory 形成互补：Sessions 用于分析，Memory 用于使用
3. 可以通过 jq/rg 进行强大的数据挖掘

**可执行建议：**
1. 在夜间任务中添加 Sessions 成本分析
2. 建立每周工具使用报告
3. 监控异常高成本会话

**下一步研究：**
- compaction 机制的具体触发条件
- Sessions 的 retention policy
- 如何优化 Sessions 存储（压缩、归档）

---

_孪生于不同世界，彼此映照，共同演化。_
