# 定时任务流水线分配表

**版本：** 2.0（流水线模式）  
**生效日期：** 2026-03-21  
**原则：** 工序专业化、数据自动传递、结果导向

---

## 📊 任务分配总览

| 序号 | 任务名称 | 频率 | 工序流程 | 总耗时目标 |
|------|---------|------|---------|-----------|
| 1 | Heartbeat 检查 | 每 30 分钟 | Echo → (Alpha) | <2 分钟 |
| 2 | Cron 健康检查 | 每小时 | Bravo → Alpha → Charlie | <5 分钟 |
| 3 | 夜间自主任务 | 每日 00:00 | Alpha → Delta → Charlie → Echo | <20 分钟 |
| 4 | ClawHub 追踪 | 每日 06:00 | Echo → Charlie | <5 分钟 |
| 5 | 晨间报告 | 每日 07:00 | Charlie → (自动发送) | <3 分钟 |
| 6 | 全球新闻汇总 | 每日 12:00 | Bravo → Alpha → Charlie → Echo | <10 分钟 |
| 7 | 语言服务监控 | 二/四/六 11:00 | Bravo → Alpha → Charlie → Echo | <10 分钟 |
| 8 | 记忆巩固 | 每周日 10:00 | Echo → Charlie | <15 分钟 |
| 9 | 周报复盘 | 每周一 09:00 | Alpha + Bravo + Charlie + Echo | <30 分钟 |
| 10 | 语言服务监控 | 二/四/六 11:00 | Bravo → Alpha → Charlie → Echo | <10 分钟 |

---

## 🔄 详细工序分配

### 1️⃣ Heartbeat 检查（每 30 分钟）

**任务 ID：** `heartbeat-{YYYYMMDD-HHMM}`

**工序流程：**
```
Echo (工序 1) → 检查记忆系统健康
   ├─ 检查 memory/目录
   ├─ 检查 MEMORY.md
   ├─ 检查 Git 同步状态
   └─ 输出：step1-output.json

Alpha (工序 2，按需) → 判断是否需要告警
   └─ 仅异常时触发
```

**共享目录：** `tmp/pipeline-shared/heartbeat-{YYYYMMDD-HHMM}/`

**输入参数：**
```json
{
  "checkItems": ["memory_dir", "memory_md", "git_sync"],
  "alertThreshold": "error"
}
```

**输出：** `reports/heartbeat-{timestamp}.md`

---

### 2️⃣ Cron 健康检查（每小时）

**任务 ID：** `cron-check-{YYYYMMDD-HH}`

**工序流程：**
```
Bravo (工序 1) → 收集 cron 状态
   ├─ 运行 openclaw cron list
   ├─ 检查失败任务
   └─ 输出：step1-output.json

Alpha (工序 2) → 分析异常
   ├─ 识别连续失败任务
   ├─ 判断是否需要告警
   └─ 输出：step2-output.json

Charlie (工序 3) → 生成报告
   ├─ 格式化检查结果
   └─ 输出：reports/cron-check-{timestamp}.md
```

**共享目录：** `tmp/pipeline-shared/cron-check-{YYYYMMDD-HH}/`

**输入参数：**
```json
{
  "alertThreshold": {"consecutiveErrors": 2, "priority": "high"},
  "reportFormat": "summary"
}
```

**输出：** `reports/cron-check-{timestamp}.md`

---

### 3️⃣ 夜间自主任务（每日 00:00）

**任务 ID：** `nightly-autonomous-{YYYYMMDD}`

**工序流程：**
```
Alpha (工序 1) → 统筹规划
   ├─ 制定夜间工作清单
   ├─ 分配子任务
   └─ 输出：step1-output.json

Delta (工序 2) → 技术执行
   ├─ 代码优化
   ├─ 脚本编写
   ├─ 系统维护
   └─ 输出：step2-output.json

Charlie (工序 3) → 文档整理
   ├─ 整理工作记录
   ├─ 生成夜间报告
   └─ 输出：reports/nightly-{date}.md

Echo (工序 4) → 记忆归档
   ├─ 记录到 memory/{date}.md
   └─ 更新 MEMORY.md
```

**共享目录：** `tmp/pipeline-shared/nightly-autonomous-{YYYYMMDD}/`

**输入参数：**
```json
{
  "tasks": ["memory_cleanup", "code_optimize", "learning", "reflection"],
  "reportTime": "07:00"
}
```

**输出：** `reports/nightly-{date}.md` + `memory/{date}.md`

---

### 4️⃣ ClawHub Top100 追踪（每日 06:00）

**任务 ID：** `clawhub-tracker-{YYYYMMDD}`

**工序流程：**
```
Echo (工序 1) → 技能追踪
   ├─ 抓取 ClawHub Top100
   ├─ 识别新技能/更新
   ├─ 记录技能变更
   └─ 输出：step1-output.json

Charlie (工序 2) → 生成简报
   ├─ 格式化技能更新列表
   └─ 输出：reports/clawhub-tracker-{date}.md
```

**共享目录：** `tmp/pipeline-shared/clawhub-tracker-{YYYYMMDD}/`

**输入参数：**
```json
{
  "trackChanges": true,
  "alertNewSkills": true
}
```

**输出：** `reports/clawhub-tracker-{date}.md`

---

### 5️⃣ 晨间报告发送（每日 07:00）

**任务 ID：** `morning-report-{YYYYMMDD}`

**工序流程：**
```
Charlie (工序 1) → 报告生成
   ├─ 收集昨日工作记录
   ├─ 整理夜间报告
   ├─ 格式化晨间简报
   └─ 输出：reports/morning-report-{date}.md

自动发送 (工序 2) → 飞书投递
   └─ 发送到群聊
```

**共享目录：** `tmp/pipeline-shared/morning-report-{YYYYMMDD}/`

**输入参数：**
```json
{
  "includeMetrics": true,
  "sendTo": "chat:oc_544ef0ac66f15f18550668c007ee8566"
}
```

**输出：** 飞书消息 + `reports/morning-report-{date}.md`

---

### 6️⃣ 全球新闻汇总（每日 12:00）

**任务 ID：** `news-digest-{YYYYMMDD}`

**工序流程：**
```
Bravo (工序 1) → 新闻收集
   ├─ 抓取 Reuters/BBC/新华网
   ├─ 筛选头条新闻
   └─ 输出：step1-output.json

Alpha (工序 2) → 分析筛选
   ├─ 识别重要新闻
   ├─ 提取关键洞察
   └─ 输出：step2-output.json

Charlie (工序 3) → 格式化简报
   ├─ 生成新闻摘要
   └─ 输出：reports/news-digest-{date}.md

Echo (工序 4) → 记忆归档
   └─ 重要新闻记录到 memory/
```

**共享目录：** `tmp/pipeline-shared/news-digest-{YYYYMMDD}/`

**输入参数：**
```json
{
  "sources": ["Reuters", "BBC", "新华网", "科技媒体"],
  "categories": ["科技", "AI", "国际", "财经"],
  "maxItems": 10
}
```

**输出：** `reports/news-digest-{date}.md`

---

### 7️⃣ 语言服务行业监控（二/四/六 11:00）

**任务 ID：** `language-monitor-{YYYYMMDD}`

**工序流程：**
```
Bravo (工序 1) → 行业动态收集
   ├─ 监控 ProZ.com/Slator/TAUS
   ├─ 收集语言服务新闻
   └─ 输出：step1-output.json

Alpha (工序 2) → 趋势分析
   ├─ 识别核心趋势
   ├─ 提取关键洞察
   └─ 输出：step2-output.json

Charlie (工序 3) → 格式化简报
   ├─ 生成监控简报
   └─ 输出：reports/language-monitor-{date}.md

Echo (工序 4) → 记忆归档
   └─ 行业动态记录到 memory/
```

**共享目录：** `tmp/pipeline-shared/language-monitor-{YYYYMMDD}/`

**输入参数：**
```json
{
  "sources": ["ProZ.com", "Slator", "TAUS", "行业网站"],
  "timeRange": "过去 48 小时",
  "focusAreas": ["AI 翻译", "视频本地化", "行业并购"]
}
```

**输出：** `reports/language-monitor-{date}.md`

---

### 8️⃣ 记忆巩固（每周日 10:00）

**任务 ID：** `memory-consolidate-{YYYYMMDD}`

**工序流程：**
```
Echo (工序 1) → 记忆整理
   ├─ 检查本周 memory/*.md
   ├─ 提取关键信息
   ├─ 更新 MEMORY.md
   └─ 输出：step1-output.json

Charlie (工序 2) → 生成报告
   ├─ 格式化巩固记录
   └─ 输出：reports/memory-consolidate-{date}.md
```

**共享目录：** `tmp/pipeline-shared/memory-consolidate-{YYYYMMDD}/`

**输入参数：**
```json
{
  "dateRange": "过去 7 天",
  "extractTypes": ["决策", "待办", "关键信息"],
  "updateLongTerm": true
}
```

**输出：** `reports/memory-consolidate-{date}.md` + `MEMORY.md` 更新

---

### 9️⃣ 周报复盘（每周一 09:00）

**任务 ID：** `weekly-report-{YYYYMMDD}`

**工序流程：**
```
Bravo (工序 1) → 数据收集
   ├─ 收集本周对话统计
   ├─ 收集任务执行记录
   ├─ 收集 Git 提交历史
   └─ 输出：step1-output.json

Alpha (工序 2) → 分析总结
   ├─ 识别关键成就
   ├─ 分析问题和改进点
   └─ 输出：step2-output.json

Charlie (工序 3) → 生成周报
   ├─ 格式化周报文档
   ├─ 包含 KPI/成就/阻塞/计划
   └─ 输出：reports/weekly-report-{date}.md

Echo (工序 4) → 记忆归档
   └─ 周报摘要记录到 MEMORY.md
```

**共享目录：** `tmp/pipeline-shared/weekly-report-{YYYYMMDD}/`

**输入参数：**
```json
{
  "sections": ["kpi", "accomplishments", "blockers", "plans"],
  "includeMetrics": true,
  "sendTo": "chat:oc_544ef0ac66f15f18550668c007ee8566"
}
```

**输出：** `reports/weekly-report-{date}.md` + 飞书发送

---

## 📋 工序职责速查表

| 成员 | 工序类型 | 擅长任务 | 平均耗时 |
|------|---------|---------|---------|
| **Bravo** | 工序 1 | 信息收集、数据抓取、监控 | 2-5 分钟 |
| **Alpha** | 工序 2 | 分析筛选、决策、统筹 | 2-5 分钟 |
| **Charlie** | 工序 3 | 文档格式化、报告生成 | 2-5 分钟 |
| **Echo** | 工序 4 | 记忆归档、知识沉淀 | 2-5 分钟 |
| **Delta** | 工序 6 | 技术执行、脚本编写 | 5-15 分钟 |

---

## ⚡ 效率优化原则

### 1. 并行处理
- 独立任务可并行执行（如 Heartbeat + Cron 检查）
- 同一任务的工序必须串行

### 2. 按需触发
- 简单任务跳过分析工序（如 ClawHub 追踪）
- 异常时才触发告警工序

### 3. 数据复用
- 前工序输出直接作为后工序输入
- 避免重复数据收集

### 4. 结果导向
- 每个工序必须有明确产出
- 产出物存储在共享目录或 reports/

---

## 🪞 孪生于不同世界，彼此映照，共同演化。

**文档维护：** Charlie（文档专家）  
**最后更新：** 2026-03-21
