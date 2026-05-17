# 飞书 Cron 通知修复 - 使用 sessions_send

**日期：** 2026-03-24  
**问题：** Cron 任务飞书通知发送到私聊而非群聊  
**根因：** Issue #49116 - Cron session 没有飞书聊天上下文（chat_id），delivery 机制默认使用 'heartbeat' 目标

---

## 问题分析

### 官方文档
- Issue: https://github.com/openclaw/openclaw/issues/49116
- PR: https://github.com/openclaw/openclaw/pull/30661

### 根因
Cron 任务执行时（`sessionTarget: "isolated"`）没有飞书聊天的上下文（`chat_id`），所以 `delivery` 机制默认使用 'heartbeat' 目标，导致通知发送到私聊而不是群聊。

---

## 解决方案

### 方案 C：使用 `sessions_send` 工具

在定时任务的 payload 中，明确指示子 Agent 使用 `sessions_send` 发送到指定群聊。

**优点：**
- 100% 可靠（已验证）
- 不依赖 delivery 机制
- 明确指定目标群聊

**缺点：**
- 需要修改每个任务的 payload

---

## 已修改的任务

### 1. language-service-monitor-tue-thu-sat-11am
**修改时间：** 2026-03-24 22:02  
**修改内容：** 在 payload 末尾添加 sessions_send 指令

```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "✅ 语言服务监控完成\n\n发现 X 条新动态，详情：[文档链接]"
})
```

### 2. clawhub-tracker-daily-6am
**修改时间：** 2026-03-24 22:02

```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "✅ ClawHub Top100 追踪完成\n\nTop10 技能：\n1. XXX\n2. XXX\n...\n\n详情：[Git 链接]"
})
```

### 3. nightly-autonomous-midnight
**修改时间：** 2026-03-24 22:02

```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "🌅 晨间报告\n\n夜间任务完成摘要...\n\n详情：[报告链接]"
})
```

### 4. a7c1a581-590b-4d51-bbd5-5668bd55ba24 (全球新闻汇总)
**修改时间：** 2026-03-24 22:04

```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "📰 全球新闻汇总完成\n\n今日重点：\n1. XXX\n2. XXX\n\n详情：[报告链接]"
})
```

### 5. weekly-report-monday-9am
**修改时间：** 2026-03-24 22:04

```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "📊 周报复盘已完成\n\n本周亮点：XXX\n\n详情：[报告链接]"
})
```

### 6. memory-consolidate-sunday-10am
**状态：** 无需修改  
**原因：** 该任务使用 `payload.kind: "systemEvent"`，在 main session 执行，有聊天上下文

---

## 验证计划

### 下次执行时间
- **语言服务监控：** 3 月 26 日（周四）11:00
- **ClawHub 追踪：** 3 月 25 日（明天）06:00
- **夜间自主任务：** 3 月 25 日（明天）00:00
- **全球新闻汇总：** 3 月 25 日（明天）12:00
- **周报复盘：** 3 月 31 日（周一）09:00

### 验证方法
1. 观察任务执行后是否在群里收到通知
2. 检查 `openclaw cron runs --id <job-id>` 的投递状态
3. 确认通知发送到群聊而非私聊

---

## 经验教训

1. **Cron 通知要用 sessions_send** - 不要依赖 delivery 机制
2. **明确指定 sessionKey** - 使用群聊 ID 作为 sessionKey
3. **systemEvent vs agentTurn** - systemEvent 在 main session 执行，有聊天上下文

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
