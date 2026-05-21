# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## OpenClaw 定时任务

**重要：** OpenClaw 有自己的内部调度系统，**不依赖系统 crontab**！

- 配置文件：`~/.openclaw/cron/jobs.json`
- 查看任务：直接 read 这个文件
- 不要只查 `crontab -l` 或 `systemctl list-timers` —— 那些是系统级的，OpenClaw 的任务不在那里

### `wakeMode` 使用指南

**`wakeMode: "next-heartbeat"` 的含义：**
- 任务到期后**不立即执行**，而是等待 heartbeat 会话唤醒时才执行
- 适合：低优先级任务、批量合并执行、资源敏感型任务
- ❌ **不适合**：时间敏感任务、健康检查、重要通知

**配置原则：**
1. **默认不要用 `wakeMode`** —— 让任务到点就执行
2. **只有明确需要延迟/合并时才用** —— 且必须有活跃的 heartbeat 机制
3. **重要任务永远独立运行** —— 避免循环依赖

**教训 (2026-03-13)：** 记忆健康检查配置了 `wakeMode` 但没有 heartbeat 定时任务，导致任务永远无法执行。修复：删除 `wakeMode` 行。

**教训 (2026-05-21)：** `deepseek-v3.2` 虽然在 bailian-coding-plan provider 配置里，但编码计划代理（coding.dashscope）不支持它的工具调用格式，报 "provider rejected the request schema or tool payload" 错误。脚本类任务不要用 deepseek-v3.2，改用 qwen3.6-plus。

**教训 (2026-05-21)：** 默认 timeout 120s 太紧，多个任务在 model-call-started 阶段超时。脚本类任务至少 180s，报告类任务至少 240-300s。

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
