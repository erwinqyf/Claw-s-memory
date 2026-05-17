# 流水线共享工作区

**用途：** 多 Agent 协作时的数据传递和共享

---

## 目录结构

```
tmp/pipeline-shared/
├── {task-id}/          # 每个任务一个独立目录
│   ├── input.json      # 任务输入（调度员创建）
│   ├── step1-output.json  # 工序 1 输出
│   ├── step2-output.json  # 工序 2 输出
│   ├── step3-output.json  # 工序 3 输出
│   └── final-output.json  # 最终产出
└── README.md           # 本文件
```

---

## 使用规范

### 调度员（Claw）职责
1. 创建任务目录：`tmp/pipeline-shared/{task-id}/`
2. 写入初始输入：`input.json`
3. 通知工序 1 开始，传入任务 ID
4. 等待每个工序完成，触发下一工序
5. 收集最终输出，清理临时文件

### 工序 Agent 职责
1. 从 `tmp/pipeline-shared/{task-id}/` 读取输入
   - 工序 1 读取 `input.json`
   - 工序 2 读取 `step1-output.json`
   - 工序 3 读取 `step2-output.json`
2. 执行任务
3. 将输出写入 `tmp/pipeline-shared/{task-id}/step{N}-output.json`
4. 通知调度员完成

---

## 数据格式示例

### input.json
```json
{
  "taskId": "language-monitor-20260321",
  "taskName": "语言服务行业监控",
  "createdAt": "2026-03-21T20:53:00+08:00",
  "steps": [
    {"id": 1, "agent": "Bravo", "name": "信息收集"},
    {"id": 2, "agent": "Alpha", "name": "分析筛选"},
    {"id": 3, "agent": "Charlie", "name": "格式化"},
    {"id": 4, "agent": "Echo", "name": "记忆沉淀"}
  ],
  "params": {
    "monitorDate": "2026-03-21",
    "monitorTime": "11:00"
  }
}
```

### step1-output.json
```json
{
  "step": 1,
  "agent": "Bravo",
  "completedAt": "2026-03-21T20:57:00+08:00",
  "status": "success",
  "data": {
    "collectedItems": [...],
    "summary": "..."
  }
}
```

---

## 任务 ID 命名规范

格式：`{任务类型}-{YYYYMMDD}`

示例：
- `language-monitor-20260321`
- `cron-health-check-20260321`
- `morning-report-20260322`
- `weekly-report-20260323`

---

## 清理策略

- 任务完成后保留 7 天
- 调度员定期清理过期任务目录
