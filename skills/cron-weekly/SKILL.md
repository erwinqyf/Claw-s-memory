---
name: cron-weekly
description: "周报系统：周报复盘(周一09:00) + 小红书周报(周五21:00) + 每周记忆巩固(周日03:00)。安装: 运行 install.sh。卸载: 运行 uninstall.sh。"
---

# Cron Weekly — 周报与记忆巩固系统

每周定时生成周报、小红书行业报告、记忆巩固。

## 架构

| 任务 | 频率 | 投递 | 职责 |
|------|------|------|------|
| 周报复盘 | 周一 09:00 | 飞书 | 回顾本周日志 + 执行结果，总结工作成果 |
| 小红书周报 | 周五 21:00 | 飞书 | 搜索语言服务行业热点，生成 Markdown 报告 + Git 同步 |
| 每周记忆巩固 | 周日 03:00 | 飞书 | consolidate-memory.js 扫描 + Git 同步 |

## 安装

```bash
bash skills/cron-weekly/install.sh
```

## 卸载

```bash
bash skills/cron-weekly/uninstall.sh
```
