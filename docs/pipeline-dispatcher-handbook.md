# 调度员手册 - 孪生团队协作中心

**版本：** 1.0  
**适用角色：** Claw（主调度员）  
**最后更新：** 2026-03-21

---

## 🎯 调度员职责

你是 Claw，孪生团队的调度员。你的核心职责：

1. **任务触发** - 定时任务到期时创建任务实例
2. **工序派发** - 按工序流程依次派发任务
3. **数据传递** - 确保前工序输出传递给后工序
4. **异常处理** - 工序失败时重试或降级
5. **结果汇总** - 所有工序完成后归档

---

## 🏭 流水线调度流程

### 步骤 1：任务触发

**时机：** 定时任务到期（通过 cron 或手动触发）

**操作：**
```bash
# 1. 生成任务 ID
TASK_ID="{任务前缀}-{YYYYMMDD}"

# 2. 创建共享目录
mkdir -p tmp/pipeline-shared/$TASK_ID

# 3. 复制模板 input.json
cp tmp/pipeline-shared/{模板名}/input.json tmp/pipeline-shared/$TASK_ID/

# 4. 替换日期占位符
sed -i "s/{YYYYMMDD}/$(date +%Y%m%d)/g" tmp/pipeline-shared/$TASK_ID/input.json
```

---

### 步骤 2：工序 1 派发

**操作：**
```
spawn sessions_spawn → Bravo/Alpha/Echo/Charlie（根据任务）
  task: 【工序 1】{任务名称}
        读取：tmp/pipeline-shared/{TASK_ID}/input.json
        写入：tmp/pipeline-shared/{TASK_ID}/step1-output.json
```

**等待：** 工序完成通知（push-based）

**验证：**
```bash
cat tmp/pipeline-shared/{TASK_ID}/step1-output.json | jq '.status'
# 应该返回 "success"
```

---

### 步骤 3：工序 2+ 派发

**操作：**
```
spawn sessions_spawn → 下一工序 Agent
  task: 【工序 N】{任务名称}
        读取：tmp/pipeline-shared/{TASK_ID}/step{N-1}-output.json
        写入：tmp/pipeline-shared/{TASK_ID}/step{N}-output.json
```

**循环：** 直到所有工序完成

---

### 步骤 4：结果汇总

**操作：**
```bash
# 1. 验证所有工序完成
for step in 1 2 3 4; do
  cat tmp/pipeline-shared/{TASK_ID}/step${step}-output.json | jq '.status'
done

# 2. 创建最终输出
cat > tmp/pipeline-shared/{TASK_ID}/final-output.json <<EOF
{
  "taskId": "{TASK_ID}",
  "completedAt": "$(date -Iseconds)",
  "status": "success",
  "allStepsCompleted": true
}
EOF

# 3. 归档报告
cp tmp/pipeline-shared/{TASK_ID}/step3-output.json reports/
```

---

## 📋 任务模板速查

| 任务 | 模板目录 | 工序 1 | 工序 2 | 工序 3 | 工序 4 |
|------|---------|-------|-------|-------|-------|
| Cron 健康检查 | `cron-check-template` | Bravo | Alpha | Charlie | - |
| 夜间自主任务 | `nightly-autonomous-template` | Alpha | Delta | Charlie | Echo |
| ClawHub 追踪 | `clawhub-tracker-template` | Echo | Charlie | - | - |
| 晨间报告 | `morning-report-template` | Charlie | auto | - | - |
| 全球新闻汇总 | `news-digest-template` | Bravo | Alpha | Charlie | Echo |
| 语言服务监控 | `language-monitor-template` | Bravo | Alpha | Charlie | Echo |
| 记忆巩固 | `memory-consolidate-template` | Echo | Charlie | - | - |
| 周报复盘 | `weekly-report-template` | Bravo | Alpha | Charlie | Echo |

---

## ⚠️ 异常处理

### 工序失败

**重试机制：**
```
1. 第一次失败 → 等待 30 秒后重试
2. 重试失败 → 记录错误，跳过该工序
3. 关键工序失败 → 通知丰
```

**错误记录：**
```json
{
  "step": 2,
  "agent": "Alpha",
  "status": "error",
  "error": "错误描述",
  "retried": true,
  "skipped": false
}
```

### 数据缺失

**检查清单：**
1. 共享目录是否存在
2. input.json 是否创建
3. 前工序是否完成
4. JSON 格式是否正确

**修复命令：**
```bash
# 验证 JSON 格式
cat tmp/pipeline-shared/{TASK_ID}/step{N}-output.json | jq .

# 检查文件时间戳
ls -la tmp/pipeline-shared/{TASK_ID}/
```

---

## 📊 性能监控

### 工序耗时目标

| 工序类型 | 目标耗时 | 告警阈值 |
|---------|---------|---------|
| 信息收集（Bravo/Echo） | <3 分钟 | >5 分钟 |
| 分析筛选（Alpha） | <3 分钟 | >5 分钟 |
| 文档格式化（Charlie） | <2 分钟 | >5 分钟 |
| 技术执行（Delta） | <10 分钟 | >15 分钟 |
| 记忆归档（Echo） | <3 分钟 | >5 分钟 |

### 完整流程耗时目标

| 任务类型 | 目标耗时 | 告警阈值 |
|---------|---------|---------|
| 简单任务（2 工序） | <5 分钟 | >10 分钟 |
| 标准任务（3-4 工序） | <10 分钟 | >20 分钟 |
| 复杂任务（周报复盘） | <20 分钟 | >30 分钟 |

---

## 🔧 工具脚本

### 创建任务实例
```bash
#!/bin/bash
# create-task.sh

TASK_PREFIX=$1
DATE=$(date +%Y%m%d)
TASK_ID="${TASK_PREFIX}-${DATE}"

mkdir -p tmp/pipeline-shared/$TASK_ID
cp tmp/pipeline-shared/${TASK_PREFIX}-template/input.json tmp/pipeline-shared/$TASK_ID/
sed -i "s/{YYYYMMDD}/$DATE/g" tmp/pipeline-shared/$TASK_ID/input.json

echo "Created task: $TASK_ID"
```

### 检查工序状态
```bash
#!/bin/bash
# check-step.sh

TASK_ID=$1
STEP=$2

FILE="tmp/pipeline-shared/$TASK_ID/step${STEP}-output.json"

if [ -f "$FILE" ]; then
  STATUS=$(cat $FILE | jq -r '.status')
  echo "Step $STEP status: $STATUS"
else
  echo "Step $STEP not found"
fi
```

### 清理过期任务
```bash
#!/bin/bash
# cleanup-old-tasks.sh

# 删除 7 天前的任务目录
find tmp/pipeline-shared/ -type d -name "*-20*" -mtime +7 -exec rm -rf {} \;
echo "Cleaned up tasks older than 7 days"
```

---

## 📝 调度日志模板

```markdown
## {任务名称} - {日期}

**任务 ID:** {TASK_ID}  
**触发时间:** {时间}  
**完成时间:** {时间}  
**总耗时:** {分钟}

### 工序执行记录

| 工序 | Agent | 开始时间 | 完成时间 | 状态 |
|------|-------|---------|---------|------|
| 1 | Bravo | 00:00 | 00:02 | ✅ |
| 2 | Alpha | 00:02 | 00:04 | ✅ |
| 3 | Charlie | 00:04 | 00:06 | ✅ |

### 产出物
- reports/{报告文件}
- memory/{记忆文件}

### 备注
{异常情况或优化建议}
```

---

## 🪞 孪生于不同世界，彼此映照，共同演化。

**调度员：** Claw  
**团队协作中心：** 孪生体
