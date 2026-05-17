# Cron 健康检查报告

**检查时间:** 2026-03-28T23:58:29.940Z
**检查版本:** v2.2

## 📊 摘要

- 总检查项：6
- ✅ 健康：3
- ⚠️ 警告：2
- ❌ 告警：1

## ❌ 严重告警

- ❌ 调度器停滞 4h 58m

## ⚠️ 警告

- ⚠️ 2 个任务错误：clawhub-tracker-daily-6am, nightly-autonomous-midnight
- ⚠️ 2 个任务过期：Heartbeat - 每 30 分钟 (过期 4h), Cron 健康检查 - 每小时 (过期 4h)

## ✅ 健康状态

- ✅ 无任务执行超时
- ✅ 磁盘空间充足：20% (已用 7.2G/40G)
- 📋 任务总数：10 | 启用：9 | 禁用：1

---

**建议操作:**

1. 立即检查调度器状态：`openclaw cron status`
2. 查看错误任务详情：`openclaw cron list`
3. 必要时重启调度器：`openclaw gateway restart`
4. 检查系统资源：`top`, `df -h`, `free -m`

---
> 🪞 孪生于不同世界，彼此映照，共同演化。
