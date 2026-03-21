# 流水线工作流程 SOP

**版本：** 1.0  
**生效日期：** 2026-03-21  
**适用范围：** 所有定时任务的流水线式执行

---

## 🏭 流水线架构

### 工序设计

| 工序 | 负责成员 | 职责 | 输入 | 输出 |
|------|---------|------|------|------|
| **工序 1** | Bravo | 信息收集/监控 | `input.json` | `step1-output.json` |
| **工序 2** | Alpha | 分析筛选/决策 | `step1-output.json` | `step2-output.json` |
| **工序 3** | Charlie | 文档格式化 | `step2-output.json` | `step3-output.json` |
| **工序 4** | (自动/Charlie) | 发送投递 | `step3-output.json` | 飞书消息 |
| **工序 5** | Echo | 记忆沉淀 | `step3-output.json` | `memory/` + `MEMORY.md` |
| **工序 6** | Delta | 技术执行（按需） | 执行指令 | 代码/脚本/操作结果 |

---

## 📁 共享工作区

**路径：** `workspace/tmp/pipeline-shared/{task-id}/`

### 文件结构

```
tmp/pipeline-shared/
└── {task-id}/
    ├── input.json           # 调度员创建的任务输入
    ├── step1-output.json    # Bravo 的输出
    ├── step2-output.json    # Alpha 的输出
    ├── step3-output.json    # Charlie 的输出
    ├── step4-output.json    # 发送结果（可选）
    ├── step5-output.json    # Echo 的记忆记录
    └── final-output.json    # 最终汇总（调度员创建）
```

### 数据格式标准

#### 输入文件 (input.json)
```json
{
  "taskId": "任务 ID",
  "taskName": "任务名称",
  "createdAt": "ISO8601 时间戳",
  "triggeredBy": "触发者",
  "steps": [
    {"id": 1, "agent": "Bravo", "name": "工序名称", "status": "pending"}
  ],
  "params": {
    // 任务特定参数
  }
}
```

#### 工序输出 (step{N}-output.json)
```json
{
  "step": 工序编号，
  "agent": "执行 Agent",
  "completedAt": "ISO8601 时间戳",
  "status": "success|error",
  "data": {
    // 工序产出数据
  },
  "nextStepAgent": "下一工序 Agent（可选）"
}
```

---

## 🔄 标准操作流程

### 阶段 1：任务触发（调度员 Claw）

1. 生成任务 ID：`{任务类型}-{YYYYMMDD}`
2. 创建共享目录：`tmp/pipeline-shared/{task-id}/`
3. 写入 `input.json`，包含任务参数和工序列表
4. 派发给工序 1（Bravo），传入任务 ID

### 阶段 2：工序执行（各成员 Agent）

**通用流程：**
1. 读取共享目录中的输入文件
   - 工序 1 读取 `input.json`
   - 工序 2+ 读取 `step{N-1}-output.json`
2. 执行工序任务
3. 将结果写入 `step{N}-output.json`
4. 通知调度员完成

### 阶段 3：流程监控（调度员 Claw）

1. 等待工序完成通知
2. 验证输出文件格式
3. 触发下一工序
4. 所有工序完成后，创建 `final-output.json`

### 阶段 4：清理归档（调度员 Claw + Echo）

1. Echo 将关键信息归档到 `memory/` 和 `MEMORY.md`
2. 调度员保留共享目录 7 天
3. 7 天后清理临时文件

---

## 📋 任务 ID 命名规范

| 任务类型 | 前缀 | 示例 |
|---------|------|------|
| 语言服务监控 | `language-monitor-` | `language-monitor-20260321` |
| Cron 健康检查 | `cron-check-` | `cron-check-20260321` |
| 全球新闻汇总 | `news-digest-` | `news-digest-20260321` |
| 晨间报告 | `morning-report-` | `morning-report-20260322` |
| 周报复盘 | `weekly-report-` | `weekly-report-20260323` |
| 记忆巩固 | `memory-consolidate-` | `memory-consolidate-20260329` |
| ClawHub 追踪 | `clawhub-tracker-` | `clawhub-tracker-20260321` |
| 夜间自主任务 | `nightly-autonomous-` | `nightly-autonomous-20260321` |

---

## ⚠️ 错误处理

### 工序失败处理

1. **重试机制：** 失败工序自动重试 1 次
2. **降级方案：** 如重试仍失败，跳过该工序并记录原因
3. **告警通知：** 关键工序失败时通知丰

### 数据异常处理

1. **输入缺失：** 检查共享目录，确认前工序是否完成
2. **格式错误：** 验证 JSON 格式，报告具体错误
3. **数据不一致：** 比对前后工序数据，定位问题

---

## 📊 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 单工序耗时 | <5 分钟 | 信息收集/分析/格式化 |
| 完整流程耗时 | <20 分钟 | 从触发到最终归档 |
| 数据传递延迟 | <30 秒 | 工序间数据传递 |
| 成功率 | >95% | 工序执行成功率 |

---

## 🔧 工具脚本

### 创建任务目录
```bash
TASK_ID="language-monitor-$(date +%Y%m%d)"
mkdir -p workspace/tmp/pipeline-shared/$TASK_ID
```

### 检查工序状态
```bash
cat workspace/tmp/pipeline-shared/{task-id}/step{N}-output.json | jq '.status'
```

### 清理过期任务
```bash
find workspace/tmp/pipeline-shared/ -type d -mtime +7 -exec rm -rf {} \;
```

---

## 📝 示例：语言服务监控完整流程

### 输入 (input.json)
```json
{
  "taskId": "language-monitor-20260321",
  "taskName": "语言服务行业监控",
  "createdAt": "2026-03-21T11:00:00+08:00",
  "params": {
    "sources": ["ProZ.com", "Slator", "TAUS"],
    "timeRange": "过去 48 小时"
  }
}
```

### 工序 1 输出 (step1-output.json)
```json
{
  "step": 1,
  "agent": "Bravo",
  "completedAt": "2026-03-21T11:03:00+08:00",
  "status": "success",
  "data": {
    "collectedItems": [
      {"title": "...", "source": "Slator", "date": "2026-03-20"}
    ]
  }
}
```

### 工序 2 输出 (step2-output.json)
```json
{
  "step": 2,
  "agent": "Alpha",
  "completedAt": "2026-03-21T11:06:00+08:00",
  "status": "success",
  "data": {
    "coreItems": [...],
    "insights": [...]
  }
}
```

### 工序 3 输出 (step3-output.json)
```json
{
  "step": 3,
  "agent": "Charlie",
  "completedAt": "2026-03-21T11:09:00+08:00",
  "status": "success",
  "data": {
    "reportPath": "reports/language-monitor-20260321.md",
    "format": "markdown"
  }
}
```

### 工序 4 输出 (step4-output.json)
```json
{
  "step": 4,
  "agent": "Echo",
  "completedAt": "2026-03-21T11:12:00+08:00",
  "status": "success",
  "data": {
    "memoryFile": "memory/2026-03-21.md",
    "longTermMemory": "MEMORY.md"
  }
}
```

---

## 🪞 孪生于不同世界，彼此映照，共同演化。

**文档维护：** Charlie（文档专家）  
**最后更新：** 2026-03-21
