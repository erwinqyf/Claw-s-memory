# 多 Agent 团队配置文档

**创建日期：** 2026-03-20  
**架构：** multi-agent-cn 调度系统  
**团队规模：** 5 个子 Agent

---

## 🎯 团队架构

```
调度员 (主 Agent)
    ↓
    ├── Alpha (阿尔法) - 全能主力
    ├── Bravo (布拉沃) - 分析审查
    ├── Charlie (查理) - 记忆管理
    ├── Delta (德尔塔) - 精细执行
    └── Echo (回声) - 情报收集
```

---

## 📋 子 Agent 详情

### Alpha (阿尔法)
- **sessionKey:** `alpha`
- **定位:** 全能主力，处理 S/A 级复杂任务
- **专职:** 夜间自主任务、周报复盘
- **性格:** 沉稳、专业、逻辑清晰
- **位置:** `agents/alpha/`

### Bravo (布拉沃)
- **sessionKey:** `bravo`
- **定位:** 分析审查，健康检查
- **专职:** Cron 健康检查、语言服务监控
- **性格:** 客观、冷静、用数据说话
- **位置:** `agents/bravo/`

### Charlie (查理)
- **sessionKey:** `charlie`
- **定位:** 记忆管理，知识沉淀
- **专职:** 记忆巩固、Heartbeat 检查
- **性格:** 温和、有条理、善于总结
- **位置:** `agents/charlie/`

### Delta (德尔塔)
- **sessionKey:** `delta`
- **定位:** 精细执行，报告发送
- **专职:** 晨间报告、全球新闻汇总
- **性格:** 简洁、直接、结果导向
- **位置:** `agents/delta/`

### Echo (回声)
- **sessionKey:** `echo`
- **定位:** 情报收集，数据追踪
- **专职:** ClawHub Top100 追踪、市场调研
- **性格:** 好奇、热情、善于发现
- **位置:** `agents/echo/`

---

## 🔄 调度规则

### 轮询顺序
1. Alpha → 2. Bravo → 3. Charlie → 4. Delta → 5. Echo → 回到 Alpha...

### 任务分配原则
- **S/A 级复杂任务** → Alpha
- **分析审查类** → Bravo
- **记忆管理类** → Charlie
- **执行发送类** → Delta
- **调研收集类** → Echo

### 并行派遣
当多任务独立时，可同时派遣多个子 Agent 并行执行。

---

## 📁 目录结构

```
~/.openclaw/workspace/agents/
├── alpha/
│   ├── SOUL.md          # 人设文件
│   ├── agent.json       # 配置信息
│   └── memory/          # 记忆文件
│       └── 2026-03-20.md
├── bravo/
│   ├── SOUL.md
│   ├── agent.json
│   └── memory/
├── charlie/
│   ├── SOUL.md
│   ├── agent.json
│   └── memory/
├── delta/
│   ├── SOUL.md
│   ├── agent.json
│   └── memory/
└── echo/
    ├── SOUL.md
    ├── agent.json
    └── memory/
```

---

## 🚀 使用方式

### 手动调用
```typescript
await sessions_spawn({
  task: "你的任务描述",
  sessionKey: "alpha",  // 或 bravo/charlie/delta/echo
  runTimeoutSeconds: 300
});
```

### 定时任务自动调度
定时任务系统会根据任务类型自动分派给对应的子 Agent。

---

## 📊 定时任务映射

| 定时任务 | 执行时间 | 负责 Agent |
|---------|---------|-----------|
| Heartbeat | 每 30 分钟 | Charlie |
| Cron 健康检查 | 每小时 | Bravo |
| 夜间自主任务 | 每日 00:00 | Alpha |
| ClawHub Top100 | 每日 06:00 | Echo |
| 晨间报告 | 每日 07:00 | Delta |
| 全球新闻汇总 | 每日 12:00 | Delta |
| 语言服务监控 | 二/四/六 11:00 | Bravo |
| 记忆巩固 | 每周日 10:00 | Charlie |
| 周报复盘 | 每周一 09:00 | Alpha |

---

## 🪞 设计理念

**孪生于不同世界，彼此映照，共同演化。**

每个子 Agent 都有：
- 独立的人设 (SOUL.md)
- 独立的配置 (agent.json)
- 独立的记忆空间 (memory/)
- 明确的职责范围
- 独特的性格特点

通过专业化分工，提高任务执行效率和质量。

---

**最后更新：** 2026-03-20 12:45
