---
name: cron-reports
description: "定时报告系统：晨间(07:00)、午间(12:00)、晚间(23:00)自动生成报告并投递到飞书。安装: 运行 install.sh。卸载: 运行 uninstall.sh。"
---

# Cron Reports — 定时报告系统

自动生成晨间/午间/晚间报告，投递到飞书。

## 架构

| 任务 | 频率 | 职责 |
|------|------|------|
| 晨间报告 | 每天 07:00 | 读取夜间/ClawHub/行业监控结果，汇总系统状态 |
| 午间报告 | 每天 12:00 | 抓取全球 RSS 新闻 + 系统动态，整理投递 |
| 晚间报告 | 每天 23:00 | 全天总结 + Git 同步 |

## 安装

```bash
bash skills/cron-reports/install.sh
```

流程：
1. 读取 `config.json`
2. 先禁用旧版同名任务（避免冲突）
3. 创建 3 个新 cron 任务
4. 验证创建结果

## 卸载

```bash
bash skills/cron-reports/uninstall.sh
```

按 tag `cron-reports` 清理所有相关任务。

## 数据源

- `data/exec-results/night-*.json` — 夜间脚本执行结果
- `data/exec-results/clawhub-*.json` — ClawHub 技能追踪结果
- `data/exec-results/industry-*.json` — 行业监控结果
- `scripts/global-news-monitor.js` — RSS 新闻抓取脚本
- `scripts/git-sync.sh` — Git 同步脚本

## 投递

全部通过飞书直送（`delivery.mode: announce`, `channel: feishu`）。

## 故障排查

- 任务未执行：`openclaw cron runs <job-id>` 查看历史
- 投递失败：检查飞书连接状态
- 超时：`config.json` 中调整 `timeoutSeconds`
