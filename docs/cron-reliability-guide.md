# 定时任务可靠性保障指南

**创建日期：** 2026-03-16  
**背景：** 2026-03-15 调度器停滞 10 小时 + 飞书投递配置错误

---

## 🛡️ 多层防护体系

### 第 1 层：预防（Prevention）

| 措施 | 状态 | 说明 |
|------|------|------|
| Git pre-commit hook | ✅ 已部署 | 阻止损坏的 JSON 提交 |
| 禁止手动编辑 jobs.json | ✅ 已文档化 | 只用 `openclaw cron` 命令 |
| 配置备份 | ✅ 已部署 | `data/cron-jobs-*.json` |
| 最佳实践文档 | ✅ 本文档 | 配置指南 + 故障恢复 |

### 第 2 层：监控（Detection）

| 措施 | 状态 | 说明 |
|------|------|------|
| Cron 健康检查脚本 | ✅ 已部署 | `scripts/cron-health-check.js` |
| 每小时检查任务 | ✅ 已配置 | `cron-health-check-hourly` |
| 失败告警 | ✅ 已配置 | 连续 2 次失败后告警 |
| Heartbeat 检查 | ✅ 已配置 | 每 30 分钟，包含 cron 状态 |

### 第 3 层：恢复（Recovery）

| 措施 | 状态 | 说明 |
|------|------|------|
| 最佳努力投递 | ✅ 已配置 | 投递失败不标记任务 error |
| 自动重试 | ✅ 已配置 | `retryPolicy: maxRetries=3` |
| 故障恢复流程 | ✅ 已文档化 | 见下方 |

---

## ⚙️ 关键配置说明

### 1. 失败告警配置

```bash
# 为关键任务配置失败告警
openclaw cron edit <task-id> \
  --failure-alert \
  --failure-alert-after 2 \
  --failure-alert-mode announce
```

**效果：** 连续失败 2 次后，通过飞书发送告警

**已配置任务：**
- ✅ nightly-autonomous-midnight
- ✅ clawhub-tracker-daily-6am
- ✅ weekly-report-monday-9am
- ✅ language-service-monitor-tue-thu-sat-11am

### 2. 最佳努力投递配置

```bash
# 投递失败不影响任务状态
openclaw cron edit <task-id> --best-effort-deliver
```

**效果：** 飞书投递失败时，任务状态仍为 `ok`

**已配置任务：**
- ✅ nightly-autonomous-midnight
- ✅ clawhub-tracker-daily-6am
- ✅ weekly-report-monday-9am
- ✅ language-service-monitor-tue-thu-sat-11am

### 3. 投递模式选择

| 模式 | 命令 | 适用场景 |
|------|------|----------|
| announce | `--announce` | 推荐！任务完成后发送摘要 |
| feishu | `--to <openId>` | 自定义飞书消息（需脚本配合） |
| none | `--no-deliver` | 静默执行（内部任务） |

**推荐：** 使用 `--announce`，让 OpenClaw 自动处理投递

---

## 📋 日常检查清单

### 每日检查（Heartbeat 自动执行）

- [ ] Cron 健康检查报告（`reports/cron-health-check-*.md`）
- [ ] 调度器状态（`openclaw cron status`）
- [ ] 任务列表（`openclaw cron list`）

### 每周检查（周一 Heartbeat）

- [ ] 周报复盘（`reports/weekly-*.md`）
- [ ] 清理过期报告（保留最近 4 周）
- [ ] 检查配置备份

### 告警响应

**收到失败告警时：**

1. **查看任务状态**
   ```bash
   openclaw cron list
   openclaw cron runs --id <task-id>
   ```

2. **分析错误类型**
   - 代码错误 → 修复脚本
   - 投递错误 → 检查 `--best-effort-deliver`
   - 配置错误 → 检查 `openclaw cron edit`

3. **手动执行测试**
   ```bash
   openclaw cron run <task-id>
   ```

4. **清除 stuck 状态（如需要）**
   ```bash
   # 编辑 jobs.json，删除 state.runningAtMs
   # 或使用 openclaw cron edit 刷新配置
   ```

---

## 🔧 故障恢复流程

### 场景 1：任务卡住（running 状态）

**症状：** `openclaw cron list` 显示 `running` 超过 1 小时

**恢复步骤：**

```bash
# 1. 清除 stuck 状态
python3 << 'EOF'
import json
with open('/home/admin/.openclaw/cron/jobs.json', 'r') as f:
    data = json.load(f)
for job in data['jobs']:
    if job['id'] == '<task-id>':
        if 'runningAtMs' in job.get('state', {}):
            del job['state']['runningAtMs']
            print(f"Cleared runningAtMs for {job['id']}")
with open('/home/admin/.openclaw/cron/jobs.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
EOF

# 2. 验证配置
openclaw cron list | grep <task-id>

# 3. 手动执行测试
openclaw cron run <task-id>
```

### 场景 2：调度器停滞

**症状：** `openclaw cron status` 显示 `nextWakeAtMs` 在过去

**恢复步骤：**

```bash
# 1. 检查调度器状态
openclaw cron status

# 2. 查看日志
openclaw logs | grep -i cron | tail -50

# 3. 重启 Gateway（最后手段）
openclaw gateway restart

# 4. 验证恢复
openclaw cron status
openclaw cron list
```

### 场景 3：配置损坏

**症状：** `openclaw cron list` 报错 `JSON parse error`

**恢复步骤：**

```bash
# 1. 从备份恢复
cp ~/.openclaw/workspace/data/cron-jobs-2026-03-16-final.json \
   ~/.openclaw/cron/jobs.json

# 2. 验证语法
python3 -m json.tool ~/.openclaw/cron/jobs.json > /dev/null

# 3. 重启 Gateway
openclaw gateway restart
```

---

## 📊 监控指标

| 指标 | 正常值 | 告警阈值 | 检查频率 |
|------|--------|----------|----------|
| 调度器唤醒间隔 | < 30 分钟 | > 60 分钟 | 每小时 |
| 任务连续错误 | 0 | > 2 次 | 实时告警 |
| 任务执行超时 | < 10 分钟 | > 1 小时 | 每小时 |
| 投递成功率 | > 95% | < 80% | 每日 |

---

## 📝 配置变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-03-16 | 删除 memory-health-check-daily | 代码 bug，无对应脚本 |
| 2026-03-16 | 配置 --failure-alert | 连续失败告警 |
| 2026-03-16 | 配置 --best-effort-deliver | 投递失败不影响任务状态 |
| 2026-03-16 | 配置 --announce | 统一投递模式 |

---

## 🎯 最佳实践总结

### ✅ 应该做的

1. **使用 `openclaw cron` 命令管理任务**
2. **配置失败告警** - 关键任务 `--failure-alert-after 2`
3. **配置最佳努力投递** - `--best-effort-deliver`
4. **定期备份配置** - Git 提交 + 本地备份
5. **监控健康检查报告** - 每天查看

### ❌ 不应该做的

1. **不要手动编辑 `jobs.json`**
2. **不要忽略失败告警**
3. **不要删除健康检查任务**
4. **不要配置过高的重试次数**（默认 3 次即可）

---

## 🔗 相关文档

- [Cron 防护方案](cron-protection.md)
- [健康检查脚本](../scripts/cron-health-check.js)
- [配置备份](../data/cron-jobs-2026-03-16-final.json)

---

> 孪生于不同世界，彼此映照，共同演化。🪞

**最后更新：** 2026-03-16 14:45
