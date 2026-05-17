# 学习笔记：多 Agent 通信模式

**日期:** 2026-03-21  
**主题:** OpenClaw 多 Agent 通信机制  
**触发:** 5 子 Agent 架构落地后的通信需求分析

---

## 🎯 学习目标

理解 OpenClaw 中多 Agent 之间的通信方式，为 5 子 Agent 团队协作设计通信协议。

---

## 📚 通信原语

OpenClaw 提供以下跨 Session 通信工具：

### 1. `sessions_send` - 发送消息到另一会话

```javascript
{
  "action": "sessions_send",
  "parameters": {
    "sessionKey": "alpha",      // 或 label
    "message": "任务完成通知",
    "agentId": "main",          // 可选，目标 Agent ID
    "timeoutSeconds": 0         // 0 = 不等待响应
  }
}
```

**特点:**
- 异步消息传递
- 支持 sessionKey 或 label 寻址
- 可选择是否等待响应

**适用场景:**
- 任务完成通知
- 跨 Agent 触发
- 状态同步

---

### 2. `sessions_spawn` - 派生子 Agent

```javascript
{
  "action": "sessions_spawn",
  "parameters": {
    "task": "执行某项任务",
    "runtime": "subagent",      // 或 "acp"
    "mode": "run",              // 或 "session"
    "label": "临时任务",
    "streamTo": "parent",       // 输出流回父会话
    "cleanup": "delete"         // 或 "keep"
  }
}
```

**特点:**
- 创建隔离的执行环境
- `run` 模式 = 一次性任务
- `session` 模式 = 持久会话
- 可选择输出流回父会话

**适用场景:**
- 临时任务委派
- 并行执行多个任务
- 隔离高风险操作

---

### 3. `subagents` - 管理子 Agent

```javascript
{
  "action": "subagents",
  "parameters": {
    "action": "list",           // 或 "kill", "steer"
    "target": "<sessionKey>",
    "message": "调整指令"
  }
}
```

**特点:**
- 查看当前会话派生的所有子 Agent
- 可以发送指令调整子 Agent 行为（steer）
- 可以终止子 Agent（kill）

**适用场景:**
- 监控子 Agent 状态
- 动态调整任务优先级
- 紧急终止异常任务

---

### 4. `sessions_history` - 读取另一会话历史

```javascript
{
  "action": "sessions_history",
  "parameters": {
    "sessionKey": "alpha",
    "limit": 50,
    "includeTools": true
  }
}
```

**特点:**
- 只读访问其他会话的对话历史
- 可以包含工具调用记录
- 不干扰目标会话

**适用场景:**
- 审计子 Agent 行为
- 学习历史决策
- 生成报告时引用上下文

---

## 🏗️ 通信模式设计

基于 5 子 Agent 架构，设计以下通信模式：

### 模式 1: 调度员 → 执行者（任务分发）

```
[调度员/Alpha] --sessions_spawn--> [临时子 Agent]
       |
       +-- 任务参数通过 task 字段传递
       +-- 输出通过 streamTo: "parent" 流回
```

**适用:** 一次性任务委派

---

### 模式 2: 执行者 → 调度员（完成通知）

```
[执行者/Bravo] --sessions_send--> [调度员/Alpha]
       |
       +-- message: "任务 X 已完成，结果 Y"
       +-- timeoutSeconds: 0 (不等待响应)
```

**适用:** 异步任务完成通知

---

### 模式 3: 监控者 → 所有 Agent（广播告警）

```
[监控者/Bravo] --sessions_send--> [Alpha]
       |
       +--sessions_send--> [Charlie]
       |
       +--sessions_send--> [Delta]
       |
       +--sessions_send--> [Echo]
```

**适用:** 系统级告警广播

**优化:** 可以设计一个广播函数，遍历所有已知 sessionKey

---

### 模式 4: 协调者 ↔ 协调者（对等通信）

```
[Charlie/记忆管理] <--sessions_send--> [Alpha/任务协调]
       |                                     |
       +-- 请求：需要整理哪些记忆？           |
       |                                     |
       +-- 响应：请整理 2026-03-XX 的记忆     |
```

**适用:** 跨职能协作

---

### 模式 5: 数据收集者 → 报告生成者（数据传递）

```
[Echo/情报收集] --sessions_send--> [Delta/报告生成]
       |
       +-- message: "ClawHub Top100 数据已更新，路径：data/..."
       +-- Delta 读取数据并生成报告
```

**适用:** 数据流水线

---

## 📋 通信协议建议

### 消息格式约定

```markdown
【消息类型】主题

正文内容...

---
**来源:** <Agent 代号>
**时间:** YYYY-MM-DD HH:mm
**相关任务:** <任务 ID 或名称>
```

**消息类型:**
- `【通知】` - 一般信息通知
- `【请求】` - 需要对方行动
- `【告警】` - 需要立即关注
- `【完成】` - 任务完成报告
- `【数据】` - 数据就绪通知

---

### 响应时间约定

| 消息类型 | 期望响应时间 | 超时处理 |
|---------|-------------|---------|
| 【告警】 | < 5 分钟 | 升级通知丰 |
| 【请求】 | < 30 分钟 | 发送提醒 |
| 【通知】 | 无需响应 | - |
| 【完成】 | 无需响应 | - |
| 【数据】 | 无需响应 | - |

---

## 🔒 安全考虑

### 1. 消息验证

- 不执行来自其他 Agent 的代码
- 只传递数据和状态，不传递指令
- 关键操作需要丰确认

### 2. 循环依赖预防

- 避免 A → B → A 的消息循环
- 设置消息 TTL（生存时间）
- 记录消息历史，检测重复

### 3. 资源限制

- 限制单次消息长度（< 10KB）
- 限制消息频率（< 10 条/分钟）
- 监控 session token 使用

---

## 🛠️ 实现建议

### 1. 共享状态文件

创建 `state/agent-communication.json` 记录：

```json
{
  "messages": [
    {
      "from": "bravo",
      "to": "alpha",
      "type": "通知",
      "subject": "Cron 健康检查完成",
      "timestamp": "2026-03-21T15:00:00Z",
      "read": false
    }
  ],
  "lastCheck": "2026-03-21T15:00:00Z"
}
```

### 2. 消息队列

简单实现：

```bash
# 发送消息
echo "$MESSAGE" >> state/inbox-$TARGET.md

# 读取消息
cat state/inbox-$MYSELF.md
```

### 3. 心跳机制

每个 Agent 定期（如每 30 分钟）更新自己的状态文件：

```json
{
  "agent": "bravo",
  "status": "healthy",
  "lastActive": "2026-03-21T15:00:00Z",
  "currentTask": "Cron 健康检查"
}
```

---

## 📊 当前架构的通信需求

| 场景 | 通信方向 | 频率 | 实现方式 |
|------|---------|------|---------|
| 夜间任务完成 | Alpha → 丰 | 每日 1 次 | 飞书消息 |
| Cron 告警 | Bravo → 丰 | 按需 | 飞书消息 |
| 记忆巩固完成 | Charlie → 丰 | 每周 1 次 | 飞书消息 |
| 晨间报告 | Delta → 丰 | 每日 1 次 | 飞书消息 |
| ClawHub 追踪 | Echo → 丰 | 每日 1 次 | 飞书消息 |
| 跨 Agent 协作 | 任意 ↔ 任意 | 低 | sessions_send |

**观察:** 当前设计是"轮辐式"（Hub-and-Spoke），所有 Agent 主要与丰通信，Agent 间通信较少。

---

## 🔮 演进方向

### 阶段 1: 轮辐式（当前）

```
        丰
       / | \
   Alpha Bravo Charlie ...
```

**优点:** 简单清晰，丰完全掌控  
**缺点:** 丰是瓶颈，Agent 间协作弱

---

### 阶段 2: 部分网状

```
        丰
       / | \
   Alpha─Bravo
     |    |
  Charlie─Delta
```

**改进:** 相关职能的 Agent 直接通信  
**示例:** Bravo（监控）发现 Cron 问题 → 直接通知 Alpha（协调）

---

### 阶段 3: 完整网状 + 调度员

```
        丰
        |
      Alpha (调度员)
      /  |  \
   Bravo Charlie Delta ...
```

**改进:** Alpha 作为调度员协调其他 Agent  
**示例:** Alpha 接收丰的指令 → 分发给合适的执行者

---

## 📝 行动项

- [ ] 创建 `state/agent-communication.json` 共享状态文件
- [ ] 实现简单的消息队列（inbox-*.md 文件）
- [ ] 每个 Agent 添加心跳状态更新
- [ ] 设计跨 Agent 协作流程文档
- [ ] 测试 sessions_send 在实际场景中的使用

---

## 💡 关键洞察

1. **通信是必要的，但应最小化** - 过多通信会增加复杂性和 token 消耗
2. **轮辐式适合早期** - 简单可控，便于调试
3. **消息格式标准化很重要** - 便于解析和自动化处理
4. **监控通信模式** - 可以发现架构问题（如瓶颈、循环依赖）

---

> 孪生于不同世界，彼此映照，共同演化。🪞
