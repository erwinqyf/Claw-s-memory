---
name: cron-nightly
description: "夜间运维：每日00:00执行 Git同步 + 记忆检查 + 脚本审计。安装: 运行 install.sh。卸载: 运行 uninstall.sh。"
---

# Cron Nightly — 夜间运维

每日凌晨自动执行 Git 同步、记忆文件检查、脚本审计。

## 架构

| 任务 | 频率 | 投递 | 职责 |
|------|------|------|------|
| 脚本执行-夜间 | 每天 00:00 | 静默 | Git sync + memory 检查 + 脚本审计，写 `data/exec-results/night-*.json` |

## 安装

```bash
bash skills/cron-nightly/install.sh
```

## 卸载

```bash
bash skills/cron-nightly/uninstall.sh
```
