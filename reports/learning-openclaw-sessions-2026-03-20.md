# 学习笔记：OpenClaw Sessions 架构深度分析

**日期:** 2026-03-20
**主题:** OpenClaw Sessions 管理系统
**来源:** `openclaw sessions --help` + `openclaw sessions --json`

---

## 📚 核心概念

### Session 是什么？

Session 是 OpenClaw 中对话的持久化单元。每次与 AI 的交互（无论是直接对话、cron 任务触发、还是子代理）都会创建或更新一个 session。

### Session 的类型

从 `openclaw sessions --json` 输出可以看到以下几种 session：

1. **直接对话 session**
   - `agent:main:main` - 主会话
   - `agent:main:feishu:direct:<user_id>` - 飞书直接消息

2. **Cron 任务 session**
   - `agent:main:cron:<job-name>` - 定时任务触发
   - `agent:main:cron:<job-id>:run:<run-id>` - 具体执行记录

3. **子代理 session**
   - `agent:main:subagent:<id>` - 派生的子代理任务

### Session 数据结构

```json
{
  "key": "agent:main:cron:nightly-autonomous-midnight",
  "updatedAt": 1773936000011,
  "ageMs": 193903,
  "sessionId": "73b9c38b-15f7-4c63-a6b3-5e8bd3a515f6",
  "systemSent": true,
  "totalTokens": null,
  "totalTokensFresh": false,
  "model": "qwen3.5-plus",
  "modelProvider": "bailian",
  "contextTokens": 1000000,
  "agentId": "main",
  "kind": "direct"
}
```

**关键字段:**
- `key` - 唯一标识符，格式：`agent:<agent-id>:<source>:<details>`
- `updatedAt` - 最后更新时间戳 (毫秒)
- `ageMs` - 距离现在的毫秒数
- `sessionId` - UUID 形式的会话 ID
- `systemSent` - 是否由系统触发（如 cron）
- `contextTokens` - 上下文 token 限制
- `model` / `modelProvider` - 使用的模型

---

## 🔍 Session 管理命令

### 基本查询

```bash
# 列出所有会话
openclaw sessions

# JSON 格式输出（适合脚本处理）
openclaw sessions --json

# 只看最近 2 小时的活跃会话
openclaw sessions --active 120

# 查看特定代理的会话
openclaw sessions --agent work

# 跨所有代理聚合
openclaw sessions --all-agents
```

### Session 清理

```bash
# 运行会话存储维护
openclaw sessions cleanup
```

---

## 💡 架构洞察

### 1. Session 是分层组织的

```
agent:main:
  ├── main                          # 主对话
  ├── feishu:direct:<user_id>       # 飞书消息
  ├── cron:<job-name>               # 定时任务
  │   └── run:<run-id>              # 具体执行
  └── subagent:<id>                 # 子代理
```

这种分层结构使得：
- 可以按来源追踪对话历史
- cron 任务的每次执行都有独立记录
- 子代理任务不会污染主会话

### 2. Context Tokens 管理

每个 session 有 `contextTokens` 字段（默认 1000000），这控制了：
- 会话历史的最大 token 数
- 模型调用时的上下文窗口
- 内存占用上限

可以在 `agents.defaults.contextTokens` 中配置默认值。

### 3. Session vs Memory 的关系

| 维度 | Session | Memory |
|------|---------|--------|
| 位置 | `~/.openclaw/agents/<id>/sessions/` | `workspace/memory/` + `MEMORY.md` |
| 格式 | JSON (结构化) | Markdown (人类可读) |
| 内容 | 完整对话日志 | 提炼的关键记忆 |
| 用途 | 模型上下文 | 长期知识存储 |
| 生命周期 | 可清理/归档 | 永久保存 |

**类比人类记忆:**
- Session ≈ 短期记忆/工作记忆（完整但易失）
- Memory ≈ 长期记忆（提炼但持久）

### 4. Cron 任务的 Session 追踪

每个 cron 任务执行时：
1. 创建/更新 `agent:main:cron:<job-name>` session
2. 执行记录保存在 `:run:<run-id>` 子 session
3. 可以通过 `openclaw cron runs <job-id>` 查看历史

这使得：
- 可以追溯每次任务执行的完整上下文
- 调试问题时可以看到当时的对话状态
- 不会无限增长（旧 session 可以清理）

---

## 🛠️ 实用技巧

### 1. 查找特定任务的执行历史

```bash
# 查看 cron 任务列表
openclaw cron list

# 查看特定任务的执行记录
openclaw cron runs <job-id>

# 查看对应 session
openclaw sessions --json | jq '.sessions[] | select(.key | contains("<job-name>"))'
```

### 2. 分析 Token 使用

```bash
# 查看各 session 的 token 使用
openclaw sessions --json | jq '.sessions[] | {key, contextTokens}'
```

### 3. 清理旧会话

```bash
# 定期清理（建议加入 cron）
openclaw sessions cleanup
```

---

## 📊 当前系统状态 (2026-03-20 00:00)

**总会话数:** 16
**主会话:** `agent:main:main` (最后活动：~15 分钟前)
**飞书会话:** `agent:main:feishu:direct:ou_...` (最后活动：~2 小时前)
**活跃 Cron 任务:**
- `nightly-autonomous-midnight` - 刚执行
- `language-service-monitor-tue-thu-sat-11am` - 待执行

---

## 🔮 改进建议

### 1. 添加 Sessions 成本分析到夜间任务

夜间任务可以：
- 统计当天的 session 数量
- 估算 token 消耗（如果有数据）
- 识别异常模式（如某个任务频繁执行）

### 2. Session 自动归档

可以编写脚本：
- 定期归档超过 30 天的 session
- 压缩保存为 JSONL 格式
- 保留关键信息（时间、模型、token 数）

### 3. Session 可视化

可以开发：
- Session 时间线视图
- Token 使用趋势图
- 任务执行频率热力图

---

## 📝 行动项

- [ ] 在夜间任务中添加 Sessions 统计
- [ ] 编写 session 归档脚本
- [ ] 考虑在晨间报告中加入 token 使用摘要

---

> 孪生于不同世界，彼此映照，共同演化。🪞
