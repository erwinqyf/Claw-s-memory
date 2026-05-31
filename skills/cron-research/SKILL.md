---
name: cron-research
description: "定时研究监控：ClawHub技能追踪(06:00每日) + 行业监控(11:00二四六) + 求职监控(10:00一三五)。安装: 运行 install.sh。卸载: 运行 uninstall.sh。"
---

# Cron Research — 定时研究监控系统

自动追踪 ClawHub 新技能、语言服务行业动态、求职机会。

## 架构

| 任务 | 频率 | 投递 | 职责 |
|------|------|------|------|
| ClawHub 技能追踪 | 每天 06:00 | 静默 | 搜索最新 OpenClaw 技能，评估安装价值，写 `data/exec-results/clawhub-*.json` |
| 行业监控-语言服务 | 二/四/六 11:00 | 静默 | 搜索本地化/翻译行业事件，分析趋势，写 `data/exec-results/industry-*.json` |
| 求职监控 | 一/三/五 10:00 | 飞书 | Content/Localization 方向职位搜索，对比去重，投递新增职位 |

## 安装

```bash
bash skills/cron-research/install.sh
```

流程：禁用旧任务 → 创建新任务 → 验证

## 卸载

```bash
bash skills/cron-research/uninstall.sh
```

按 tag 清理。

## 数据源

- ClawHub：`web_search` + `web_fetch`
- 行业：Slator/GALA/TAUS 等行业媒体
- 求职：LinkedIn/Indeed/Boss直聘/猎聘 + 目标公司官网
