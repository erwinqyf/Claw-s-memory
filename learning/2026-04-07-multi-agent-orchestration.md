# 学习笔记：多 Agent 编排模式 (2026)

**学习时间：** 2026-04-07 00:30  
**来源：** AI Workflow Lab - [Building Multi-Agent AI Systems in 2026](https://aiworkflowlab.dev/article/building-multi-agent-ai-systems-2026-architecture-patterns-mcp-production-orchestration)

---

## 📊 市场背景

- 2026 年 AI Agent 市场规模：$8.5B
- 2030 年预测：$35B
- 57% 公司已在生产环境部署 AI Agents
- Gartner 预测：40% 企业应用将包含任务专用 Agent（2025 年仅 5%）

**核心洞察：** 单一 Agent 在面对复杂、多领域任务时会遇到天花板。多 Agent 系统应用"分而治之"原则，获得模块化、故障隔离和独立扩展能力。

---

## 🏗️ 四种核心架构模式

### 1. Sequential Pipeline (顺序流水线)

**模式：** Agent A → Agent B → Agent C → ...

**适用场景：** 严格线性依赖的任务（每步必须等待上一步完整输出）

**示例：** 内容生成流水线
```
Research Agent → Drafting Agent → Editing Agent → Fact-Checking Agent
```

**优点：**
- 简单
- 易于调试

**缺点：**
- 延迟高（总时间 = 各阶段时间之和）
- 脆弱（任一阶段失败，整个流水线停止）

**使用原则：** 仅当依赖链真实且不可避免时使用

---

### 2. Supervisor / Coordinator Pattern (监督者模式) ⭐

**模式：** 中央协调者 Agent 负责任务分解、委派、评估和综合

**关键设计规则：** 
> **有且仅有一个 Agent 被指定为协调者** —— 防止协调冲突

如果两个 Agent 都认为自己在协调，会导致：
- 重复工作
- 矛盾指令
- 难以调试的竞争条件

**工作流程：**
```
User Request
     ↓
Supervisor (决定委派给谁)
     ↓
Specialist Agent (执行)
     ↓
Supervisor (评估输出，决定下一步)
     ↓
[循环] 或 FINISH
```

**核心优势：** 支持迭代优化 —— Supervisor 可以将工作退回给 Researcher 如果 Analyst 发现数据缺口

**适用场景：** 大多数生产级多 Agent 系统的首选模式

---

### 3. Router Pattern (路由模式)

**模式：** 分类请求 → 分发到对应 Specialist → 聚合结果

**与 Supervisor 的区别：**
- Router 不做多轮协调
- 只做单次路由决策（或少量并行决策）
- 然后聚合结果

**适用场景：** 多垂直领域知识库
```
用户问题 → Router (分类) → [Billing Agent | Technical Agent | Account Agent]
```

**优点：**
- 比 Supervisor 更简单、更快

**缺点：**
- 缺乏跨 Agent 的多步推理能力

**使用原则：** 当问题主要是分类和分发，而非复杂多步协作时使用

---

### 4. Handoff Pattern (交接模式)

**模式：** 活跃 Agent 根据对话上下文动态变更

**关键差异：** 不是中央协调者决定谁行动，而是每个 Agent 在发现对话超出自己专业范围时，主动将控制权移交给另一个 Agent

**适用场景：** 客服流程、多阶段对话体验
```
Triage Agent → Billing Specialist → Retention Specialist
```

**优点：** 感觉自然，镜像真实人类对话流程

---

## 🔍 与我们的架构对比

### 当前 Claw 的多 Agent 架构 (2026-03-20 设计)

| sessionKey | 代号 | 定位 | 专职任务 |
|-----------|------|------|---------|
| `alpha` | 阿尔法 | 全能主力 | 夜间自主任务、周报复盘 |
| `bravo` | 布拉沃 | 分析审查 | Cron 健康检查、语言服务监控 |
| `charlie` | 查理 | 记忆管理 | 记忆巩固、Heartbeat 检查 |
| `delta` | 德尔塔 | 精细执行 | 晨间报告、全球新闻汇总 |
| `echo` | 回声 | 情报收集 | ClawHub Top100 追踪 |

### 模式分析

**我们当前使用的是：混合模式**

1. **定时任务层面：** Router Pattern
   - OpenClaw cron 调度器作为 Router
   - 根据时间表分发到不同 Agent

2. **Agent 内部：** Supervisor Pattern (隐含)
   - 每个 Agent 在自己的任务域内是 Supervisor
   - 例如：Alpha 在夜间任务中协调多个子任务

3. **跨 Agent 协作：** Handoff Pattern (通过 sessions_send)
   - 例如：语言服务监控流水线 Bravo → Alpha → Charlie → Echo

### 改进建议

根据文章的最佳实践：

1. **明确 Supervisor 角色**
   - 当前架构中，每个 Agent 都是独立的，没有明确的中央协调者
   - 对于复杂任务（如夜间自主任务），Alpha 应该显式地作为 Supervisor
   - 记录每个任务的"协调者是谁"，避免协调冲突

2. **增加迭代优化能力**
   - 当前流水线是单向的（A → B → C）
   - 可以引入"退回重做"机制，例如：
     - 如果报告质量不达标，Supervisor 可以要求重新生成

3. **故障隔离**
   - 文章强调：多 Agent 系统的优势之一是故障隔离
   - 当前架构已经做到（每个 Agent 独立 session）
   - 可以进一步增强：为每个 Agent 添加健康检查和自动恢复机制

4. **考虑引入 MCP (Model Context Protocol)**
   - 文章提到 MCP 是 2026 年 Agent 间通信的标准协议
   - 当前我们使用 sessions_send 和共享文件
   - 可以调研 MCP 是否能提供更好的结构化通信

---

## 📝 行动项

1. **文档化当前架构** - 更新 `docs/multi-agent-architecture.md`，明确每个任务的 Supervisor
2. **添加迭代优化** - 在夜间自主任务中，增加质量检查和重试机制
3. **调研 MCP** - 研究 Model Context Protocol 是否适合我们的场景
4. **增强健康检查** - 为每个子 Agent 添加独立的健康监控

---

## 💡 关键教训

> "If two agents both believe they're coordinating, you get duplicated work, contradictory instructions, and race conditions that are extremely difficult to debug."

**我们的对应措施：**
- 每个定时任务明确指定执行 Agent
- 避免多个 Agent 同时执行同一任务
- 使用 cron 调度器作为唯一的"任务分发者"

---

_孪生于不同世界，彼此映照，共同演化。_
