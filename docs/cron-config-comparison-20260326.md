# Cron 配置修复对比 (2026-03-26)

## 核心变化

### 1. sessionKey 格式修复 ✅

**修复前 (错误):**
```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",  // ❌ 缺少前缀
  message: "..."
})
```

**修复后 (正确):**
```javascript
sessions_send({
  sessionKey: "agent:main:feishu:group:oc_544ef0ac66f15f18550668c007ee8566",  // ✅ 完整格式
  message: "..."
})
```

**影响范围:** 4 个 isolated 任务
- 周报复盘 - 孪生体协作总结
- ClawHub Top100 追踪 - 每日
- 语言服务行业监控 - 每周二/四/六
- 夜间自主任务 - 每日凌晨

---

### 2. delivery 配置移除 ✅

**修复前:**
```json
{
  "sessionTarget": "isolated",
  "delivery": {
    "mode": "announce",
    "channel": "feishu",
    "to": "chat:oc_544ef0ac66f15f18550668c007ee8566"
  }
}
```

**修复后:**
```json
{
  "sessionTarget": "isolated"
  // delivery 已移除
}
```

**原因:** OpenClaw Issue #48889 - Feishu runtime not initialized in isolated sessions
- Isolated session 无法访问 Feishu runtime
- `delivery: announce` 会失败 (`deliveryStatus: "unknown"`)
- 改用任务内部 `sessions_send` 更可靠

**影响范围:** 5 个 isolated 任务
- 周报复盘 - 孪生体协作总结
- ClawHub Top100 追踪 - 每日
- 语言服务行业监控 - 每周二/四/六
- 夜间自主任务 - 每日凌晨
- 全球新闻汇总 - 每日 12 点

---

### 3. 保留 delivery 配置的任务 ✅

**Main session 任务** (不受 Issue #48889 影响):
- 记忆巩固 - 每周日 (`sessionTarget: "main"`)
- 晨间报告发送 - 每日 7 点 (`sessionTarget: "main"`)

这些任务保留 `delivery` 配置，因为 main session 可以访问 Feishu runtime。

---

## 修复脚本

1. `scripts/fix-cron-delivery.js` - 移除 isolated 任务的 delivery 配置
2. `scripts/fix-all-cron-sessions.js` - 批量修复 sessions_send 的 sessionKey

---

## 验证计划

**明日观察 (2026-03-27):**
- 06:00 ClawHub Top100 追踪 - 应该收到飞书通知
- 07:00 晨间报告 - 应该收到飞书通知 (main session + delivery)
- 12:00 全球新闻汇总 - 应该收到飞书通知

**成功标志:**
- 飞书群聊收到定时任务通知
- `openclaw cron runs --id <任务>` 显示 `deliveryStatus: "not-delivered"` (因为 delivery 已移除)
- 但 Agent 在 session 中调用了 `sessions_send` 并成功发送

---

## 根本原因总结

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 飞书通知失败 | sessionKey 格式错误 | 添加完整前缀 `agent:main:feishu:group:` |
| delivery 失败 | OpenClaw Issue #48889 | 移除 isolated 任务的 delivery，改用 sessions_send |
| 通知未发送 | Agent 调用 sessions_send 但配置错误 | 修复配置后下次执行验证 |

---

**修复时间:** 2026-03-26 14:00-15:00  
**修复者:** Claw (硅基孪生体)  
**状态:** ✅ 配置已修复，⏳ 等待下次执行验证
