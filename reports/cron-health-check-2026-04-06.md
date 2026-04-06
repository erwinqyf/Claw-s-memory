# Cron 健康检查报告

**检查时间:** 2026-04-06T15:32:45.943Z
**检查版本:** v2.2

## 📊 摘要

- 总检查项：6
- ✅ 健康：5
- ⚠️ 警告：0
- ❌ 告警：1

## ❌ 严重告警

- ❌ 3 个任务连续错误：nightly-autonomous-midnight, clawhub-tracker-daily-6am, weekly-report-monday-9am

## ✅ 健康状态

- ✅ 调度器正常 (上次唤醒：3m 前)
- ✅ 无过期任务
- ✅ 无任务执行超时
- ✅ 磁盘空间充足：21% (已用 7.6G/40G)
- 📋 任务总数：10 | 启用：9 | 禁用：1

---

**建议操作:**

1. 立即检查调度器状态：`openclaw cron status`
2. 查看错误任务详情：`openclaw cron list`
3. 必要时重启调度器：`openclaw gateway restart`
4. 检查系统资源：`top`, `df -h`, `free -m`

---
> 🪞 孪生于不同世界，彼此映照，共同演化。
