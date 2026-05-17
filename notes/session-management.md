# OpenClaw 会话管理学习笔记

**学习日期:** 2026-04-16  
**主题:** sessions_send 与会话管理机制

---

## 核心概念

### 1. Session 是什么？

Session 是 OpenClaw 中的对话上下文容器：
- 每个聊天窗口（飞书私聊、群聊）对应一个 session
- Session 保存对话历史、上下文状态
- Agent 通过 session 与用户交互

### 2. Session 的类型

| 类型 | 说明 | 示例 |
|------|------|------|
| Main Session | 主会话，直接与用户对话 | `agent:main:feishu:user:xxx` |
| Group Session | 群聊会话 | `agent:main:feishu:group:xxx` |
| Sub-agent Session | 子 Agent 会话 | `agent:alpha:...` |

### 3. Session Key 格式

```
agent:<agent-id>:<channel>:<type>:<id>
```

示例：
- `agent:main:feishu:user:ou_adcbc44a6fb7460391e585338f9e1e35`
- `agent:main:feishu:group:oc_544ef0ac66f15f18550668c007ee8566`

---

## sessions_send 机制

### 1. 基本用法

```javascript
sessions_send({
  sessionKey: "agent:main:feishu:group:xxx",
  message: "消息内容"
})
```

### 2. 关键限制

**限制 1: Session 必须已存在**
- `sessions_send` 不能创建新 session
- 目标 session 必须已经通过某种方式建立

**限制 2: 飞书群聊需要 Bot 加入**
- 飞书群聊 session 不会自动创建
- Bot 必须先被邀请加入群聊
- 加入后首次交互才会创建 session

**限制 3: visibility 限制**
- 某些上下文中 `sessions_send` 被限制
- 错误：`sessions_send is not available in this context (visibility=tree)`

### 3. 与 cron delivery 的区别

| 特性 | sessions_send | cron delivery |
|------|---------------|---------------|
| 执行时机 | 立即 | 任务完成后 |
| 需要 session | 是 | 否（直接投递） |
| 配置方式 | 代码中调用 | job.delivery |
| 失败处理 | 抛出错误 | 记录 lastDeliveryStatus |

---

## 飞书通知配置

### 1. 正确的 delivery 配置

```json
{
  "delivery": {
    "mode": "announce",
    "to": "chat:oc_xxx",
    "channel": "feishu"
  }
}
```

**关键点:**
- `to` 需要 `chat:` 前缀
- 群聊 ID 格式：`chat:oc_xxxxxx`
- 用户 ID 格式：`ou_xxxxxx`（无需前缀）

### 2. 常见错误

**错误 1: 缺少 chat: 前缀**
```json
"to": "oc_xxx"  // ❌ 错误
"to": "chat:oc_xxx"  // ✅ 正确
```

**错误 2: Bot 未加入群聊**
- 错误信息：`Session not found`
- 解决：在飞书客户端邀请 Bot 加入群聊

**错误 3: delivery 状态 unknown**
- 任务执行成功但通知状态未知
- 可能原因：飞书 API 返回异常

---

## 修复方案

### 方案 A: 使用 cron delivery（推荐）

优点：
- 不依赖预存在的 session
- 配置简单，一次设置

缺点：
- 需要正确的 `chat:` 前缀
- 需要 Bot 加入群聊

### 方案 B: 使用 sessions_send

优点：
- 灵活，可在任意代码中调用
- 可自定义消息格式

缺点：
- 需要 session 已存在
- 某些上下文受限

---

## 检查清单

### 飞书通知故障排查

1. **检查 Bot 是否加入群聊**
   ```bash
   openclaw directory groups list --channel feishu
   ```
   - 如果返回 "No groups found" → Bot 未加入任何群聊

2. **检查 delivery 配置**
   ```bash
   openclaw cron list --json | grep -A5 delivery
   ```
   - 确认 `to` 有 `chat:` 前缀

3. **检查任务执行状态**
   ```bash
   openclaw cron list
   ```
   - 确认任务执行成功（非投递失败）

4. **手动测试发送**
   - 在飞书客户端 @Bot 发送消息
   - 确认能收到回复

---

## 参考资料

- OpenClaw 文档: Session Management
- 飞书开放平台: Bot 开发指南
- MEMORY.md: 2026-03-26 飞书 sessions_send 会话不存在

---

**笔记完成时间:** 2026-04-16 00:25 Asia/Shanghai
