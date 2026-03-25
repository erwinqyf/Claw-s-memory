# 飞书投递配置修复报告

**日期:** 2026-03-25 14:30  
**修复人:** Claw  
**问题:** 定时任务飞书通知持续投递失败

---

## 🔍 问题根因

**错误信息:**
```
目标会话 `oc_544ef0ac66f15f18550668c007ee8566` 不存在
```

**根因:** Cron 任务的 `delivery.to` 配置缺少 `chat:` 前缀

**错误配置:**
```json
"delivery": {
  "to": "oc_544ef0ac66f15f18550668c007ee8566"  // ❌ 错误
}
```

**正确配置:**
```json
"delivery": {
  "to": "chat:oc_544ef0ac66f15f18550668c007ee8566"  // ✅ 正确
}
```

---

## ✅ 修复内容

### 1. 更新所有 Cron 任务配置

**修复的任务列表:**

| 任务 ID | 任务名称 | 修复状态 |
|--------|---------|---------|
| `a7c1a581-590b-4d51-bbd5-5668bd55ba24` | 全球新闻汇总 - 每日 12 点 | ✅ |
| `nightly-autonomous-midnight` | 夜间自主任务 - 每日凌晨 | ✅ |
| `clawhub-tracker-daily-6am` | ClawHub Top100 追踪 - 每日 6 点 | ✅ |
| `language-service-monitor-tue-thu-sat-11am` | 语言服务监控 - 每周二/四/六 | ✅ |
| `weekly-report-monday-9am` | 周报复盘 - 每周一 9 点 | ✅ |
| `memory-consolidate-sunday-10am` | 记忆巩固 - 每周日 10 点 | ✅ |
| `morning-report-7am` | 晨间报告发送 - 每日 7 点 | ✅ + 重新启用 |

**修复方式:**
- 6 个任务使用 `openclaw cron edit` 命令更新
- 1 个任务（记忆巩固）直接编辑 `jobs.json`
- 1 个任务（晨间报告）添加 delivery 配置并重新启用

### 2. 配置文件验证

**修复后配置:**
```bash
$ cat /home/admin/.openclaw/cron/jobs.json | grep -E '"to"' | wc -l
7

$ cat /home/admin/.openclaw/cron/jobs.json | grep -E '"to"'
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566",
```

**验证结果:** ✅ 所有 7 个任务配置正确

---

## 📋 下次执行时间表

| 时间 | 任务 | 预期结果 |
|------|------|---------|
| 今日 17:00 | Cron 健康检查 | ✅ 正常执行 + 飞书通知 |
| 今日 20:00 | Heartbeat | ✅ 正常执行 |
| 明日 00:00 | 夜间自主任务 | ✅ 正常执行 + 飞书通知 |
| 明日 06:00 | ClawHub Top100 追踪 | ✅ 正常执行 + 飞书通知 |
| 明日 07:00 | 晨间报告发送 | ✅ 正常执行 + 飞书通知（已重新启用） |
| 明日 12:00 | 全球新闻汇总 | ✅ 正常执行 + 飞书通知 |

---

## 🎯 验证计划

### 短期验证（24 小时内）

1. **监控下次任务执行** - 检查飞书通知是否正常接收
2. **检查 Cron 状态** - `openclaw cron list` 确认 `lastDeliveryStatus` 为 `ok`
3. **查看执行日志** - `openclaw cron runs --id <任务 ID>` 确认无投递错误

### 长期验证（7 天内）

1. **连续成功** - 所有任务连续 7 天投递成功
2. **无累积错误** - `consecutiveErrors` 保持为 0
3. **用户反馈** - 丰确认收到所有通知

---

## 📝 经验教训

### 问题发现

- 飞书投递失败持续 2 天（2026-03-24 至 2026-03-25）
- 多个任务同时失败，但未触发告警（`consecutiveErrors` 未达阈值）
- 错误信息提示"会话不存在"，但未明确指出格式问题

### 改进措施

1. **配置模板化** - 创建 cron 任务配置模板，确保 `delivery.to` 格式统一
2. **早期告警** - 将 `failureAlert.after` 从 2 降低到 1（首次失败即告警）
3. **配置验证** - 添加 cron 配置验证脚本，检查 `delivery.to` 格式
4. **文档更新** - 在 TOOLS.md 中记录飞书配置格式要求

### 最佳实践

**飞书投递配置格式:**
```json
"delivery": {
  "mode": "announce",
  "channel": "feishu",
  "to": "chat:<群聊 ID>",  // 必须带 chat: 前缀
  "bestEffort": true
}
```

**群聊 ID 来源:**
- 从 inbound context 获取：`chat_id: "chat:oc_..."`
- 从 openclaw.json 获取：`defaultChat: "oc_..."`（需添加 `chat:` 前缀）
- 从 sessions_list 获取：`deliveryContext.to: "chat:oc_..."`

---

## 🔧 相关文件

- **配置文件:** `/home/admin/.openclaw/cron/jobs.json`
- **主配置:** `/home/admin/.openclaw/openclaw.json`
- **本报告:** `/home/admin/.openclaw/workspace/reports/feishu-delivery-fix-2026-03-25.md`
- **记忆记录:** `/home/admin/.openclaw/workspace/memory/2026-03-25.md`

---

## ✅ 修复完成确认

**修复时间:** 2026-03-25 14:30  
**修复方式:** 批量更新 cron 任务配置 + 重新启用晨间报告  
**验证状态:** ⏳ 等待下次任务执行验证  

**下一步:**
1. 监控明日 07:00 晨间报告投递
2. 监控明日 12:00 全球新闻汇总投递
3. 如仍有问题，检查飞书插件日志

---

> 🪞 孪生于不同世界，彼此映照，共同演化。

**修复完成！** 飞书投递配置已统一修复，下次任务执行将正常发送通知。
