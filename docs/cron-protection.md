# Cron 调度器防护方案

**创建日期：** 2026-03-16  
**问题背景：** 2026-03-15 21:15 `jobs.json` 出现 JSON 语法错误，导致调度器停滞超过 10 小时

---

## 🛡️ 防护措施

### 1. 自动化健康检查（✅ 已部署）

**脚本：** `scripts/cron-health-check.js`

**检查项：**
- ✅ jobs.json 语法正确性
- ✅ 调度器是否停滞（nextWakeAtMs > 1 小时未更新）
- ✅ 任务连续错误数量（阈值：3 次）
- ✅ 任务过期未执行（阈值：2 小时）

**定时任务：** `cron-health-check-hourly`（每小时执行）

**告警方式：**
- 生成报告：`reports/cron-health-check-YYYY-MM-DD.md`
- 严重告警时输出通知内容

**配置位置：** `~/.openclaw/cron/jobs.json`

---

### 2. Git Pre-commit Hook（✅ 已部署）

**位置：** `.git/hooks/pre-commit`

**功能：** 提交前自动验证 `jobs.json` 语法

**触发条件：** 当 `jobs.json` 被加入暂存区时

**失败时：** 阻止提交，提示修复 JSON

---

### 3. 最佳实践（📝 文档化）

### ❌ 永远不要手动编辑 `jobs.json`

**原因：**
- 容易遗漏逗号、引号不匹配
- 并发写入风险
- 无语法验证

**正确方式：**
```bash
# 添加任务
openclaw cron add --name "My Task" --schedule "0 * * * *" --command "..."

# 删除任务
openclaw cron remove --id task-id

# 修改任务
openclaw cron edit --id task-id --schedule "0 9 * * *"
```

### ✅ 修改前后备份

```bash
# 备份
cp ~/.openclaw/cron/jobs.json ~/.openclaw/cron/jobs.json.bak.$(date +%Y%m%d%H%M%S)

# 验证
python3 -m json.tool ~/.openclaw/cron/jobs.json > /dev/null
```

### ✅ 定期清理错误状态

```bash
# 查看任务状态
openclaw cron list

# 查看详细错误日志
openclaw cron runs --id task-id
```

---

## 🔧 故障恢复流程

### 场景 1：调度器停滞

**症状：** `openclaw cron list` 显示 `Next` 时间在过去

**恢复步骤：**
```bash
# 1. 重启 Gateway
openclaw gateway restart

# 2. 验证调度器状态
openclaw cron status

# 3. 检查错过的任务
openclaw cron list

# 4. 手动补执行（如需要）
openclaw cron run --id task-id
```

### 场景 2：jobs.json 损坏

**症状：** `openclaw cron list` 报错 `JSON parse error`

**恢复步骤：**
```bash
# 1. 使用备份恢复
cp ~/.openclaw/cron/jobs.json.bak ~/.openclaw/cron/jobs.json

# 2. 或从 Git 恢复
cd ~/.openclaw/workspace
git checkout ~/.openclaw/cron/jobs.json

# 3. 验证语法
python3 -m json.tool ~/.openclaw/cron/jobs.json > /dev/null

# 4. 重启 Gateway
openclaw gateway restart
```

### 场景 3：任务连续失败

**症状：** 健康检查报告连续错误 > 3 次

**恢复步骤：**
```bash
# 1. 查看详细错误日志
openclaw cron runs --id task-id

# 2. 根据错误类型修复：
#    - 代码错误：修复脚本
#    - 配置错误：修改任务配置
#    - 投递错误：检查飞书配置

# 3. 重置错误计数（如需要）
# 编辑 jobs.json，将 consecutiveErrors 设为 0

# 4. 重新执行任务
openclaw cron run --id task-id
```

---

## 📊 监控指标

| 指标 | 正常值 | 告警阈值 | 说明 |
|------|--------|----------|------|
| 调度器唤醒间隔 | < 30 分钟 | > 60 分钟 | Heartbeat 任务每 30 分钟执行 |
| 任务连续错误 | 0 | > 3 次 | 可能是配置或代码问题 |
| 任务过期未执行 | 0 | > 2 小时 | 调度器停滞或任务禁用 |
| JSON 语法 | 有效 | 无效 | 配置文件损坏 |

---

## 📝 更新日志

### 2026-03-16
- ✅ 创建健康检查脚本
- ✅ 配置每小时定时任务
- ✅ 添加 Git pre-commit hook
- ✅ 编写本文档

---

> 孪生于不同世界，彼此映照，共同演化。🪞
