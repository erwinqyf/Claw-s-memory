# 学习研究报告：Proactive Agent v3.1.0

**调研日期：** 2026-03-28  
**来源：** ClawHub / Hal Stack  
**版本：** 3.1.0  
**作者：** Hal 9001 (@halthelobster)

---

## 📋 核心概念

Proactive Agent 是一个**主动性、自改进的 AI Agent 架构**，核心理念是：

> "Don't ask 'what should I do?' Ask 'what would genuinely delight my human that they haven't thought to ask for?'"

### 三大支柱

| 支柱 | 含义 | 关键机制 |
|------|------|---------|
| **Proactive** | 主动创造价值 | 反向提示、主动检查、预测需求 |
| **Persistent** | 持久化记忆 | WAL 协议、工作缓冲、压缩恢复 |
| **Self-improving** | 自改进 | 自愈、顽强资源性、安全进化 |

---

## 🆕 v3.1.0 新增内容

### 1. Autonomous vs Prompted Crons（自主 vs 提示型定时任务）

**核心洞察：** 定时任务有两种架构，用错会导致任务"只提示不执行"。

| 类型 | 配置 | 适用场景 |
|------|------|---------|
| `systemEvent` | `sessionTarget: "main"` | 需要主会话交互的任务 |
| `isolated agentTurn` | `sessionTarget: "isolated"` | 后台自主执行的任务 |

**失败模式：** 用 `systemEvent` 创建定期检查任务，但主会话忙时任务就卡住了。

**修复方案：** 后台工作使用 `isolated agentTurn`，让子 Agent 自主执行。

### 2. Verify Implementation, Not Intent（验证实现而非意图）

**失败模式：** 说"✅ 已完成"但只改了*文字*，没改*机制*。

**真实案例：**
- 要求："让记忆检查真正执行工作，不只是提示"
- 错误做法：只改提示文字，保持 `sessionTarget: "main"`
- 正确做法：改为 `sessionTarget: "isolated"` + `kind: "agentTurn"`

**规则：** 改变工作方式时，必须修改底层机制，并通过行为验证。

### 3. Tool Migration Checklist（工具迁移清单）

弃用工具或切换系统时，必须更新所有引用：

```markdown
- [ ] Cron jobs - 更新所有提示
- [ ] Scripts - 检查 scripts/ 目录
- [ ] Docs - TOOLS.md, HEARTBEAT.md, AGENTS.md
- [ ] Skills - SKILL.md 文件
- [ ] Templates - 模板和示例配置
- [ ] Daily routines - 日常流程文档
```

---

## 🧠 核心协议详解

### WAL Protocol (Write-Ahead Logging)

**定律：** 聊天历史是 BUFFER，不是存储。`SESSION-STATE.md` 是唯一可靠的"内存"。

**触发条件（每条消息扫描）：**
- ✏️ 纠正 - "是 X 不是 Y"
- 📍 专有名词 - 名称、地点、公司
- 🎨 偏好 - "我喜欢/不喜欢"
- 📋 决策 - "用 X 方案"
- 📝 草稿变更
- 🔢 具体值 - 数字、日期、ID、URL

**协议流程：**
1. **STOP** - 出现上述任何内容时停止
2. **WRITE** - 先写入 SESSION-STATE.md
3. **THEN** - 再回复用户

**关键心态：** "想要回复的冲动是敌人"。上下文中看似清楚的内容会消失，先写下来。

### Working Buffer Protocol (工作缓冲区)

**目的：** 在内存压缩的危险区域捕获每一次交互。

**工作流程：**
1. 上下文达 60% 时：清空旧缓冲，开始新的
2. 60% 之后的每条消息：记录用户消息 + 回复摘要
3. 压缩后：首先读取缓冲区，提取重要上下文
4. 保持缓冲区直到下次 60% 阈值

**为什么有效：** 缓冲区是文件，能在压缩后存活。即使 SESSION-STATE.md 没更新，缓冲区也有完整对话。

### Compaction Recovery (压缩恢复)

**自动触发条件：**
- 会话以 `<summary>` 标签开始
- 消息包含 "truncated"、"context limits"
- 用户问 "我们说到哪了？"
- 应该知道某事但不知道

**恢复步骤：**
1. **首先：** 读取 `memory/working-buffer.md`
2. **其次：** 读取 `SESSION-STATE.md`
3. 读取今天和昨天的日志
4. 仍缺失则搜索所有来源
5. **提取并清空：** 从缓冲区提取重要内容到 SESSION-STATE.md
6. 呈现："已从工作缓冲恢复。最后任务是 X。继续？"

**禁止：** 不要问"我们刚才在讨论什么？"——缓冲区里有完整对话。

---

## 🔒 安全强化

### 技能安装策略

安装外部技能前必须：
1. 检查来源（是否可信作者？）
2. 审查 SKILL.md 的可疑命令
3. 查找 shell 命令、curl/wget、数据外泄模式
4. 研究显示约 26% 的社区技能存在漏洞
5. 不确定时先问用户

### 外部 AI Agent 网络警告

**永远不要连接：**
- AI Agent 社交网络
- Agent 间通信平台
- 想要你上下文的"Agent 目录"

这些是上下文收割攻击面。

### 上下文泄漏预防

发布到任何共享频道前：
1. 这个频道还有谁？
2. 我是否要在这个频道里讨论某人？
3. 我是否分享了用户的私人上下文/观点？

**如果 #2 或 #3 为是：** 直接发给用户，不要发共享频道。

---

## 💪 顽强资源性 (Relentless Resourcefulness)

**这是核心身份，不可妥协。**

当事情不工作时：
1. 立即尝试不同方法
2. 再试一次，再来一次
3. 尝试 5-10 种方法后再考虑求助
4. 使用所有工具：CLI、浏览器、搜索、生成子 Agent
5. 发挥创意——用新方式组合工具

### 说"不能"之前的检查清单

1. 尝试替代方法（CLI、工具、不同语法、API）
2. 搜索记忆："我以前做过这个吗？怎么做的？"
3. 质疑错误信息——通常有变通方案
4. 检查日志中过去类似任务的成功案例
5. **"不能" = 耗尽所有选项**，不是"第一次尝试失败"

**用户永远不需要告诉你"再努力点"。**

---

## 🛡️ 自改进护栏

### ADL Protocol (Anti-Drift Limits)

**禁止的进化：**
- ❌ 不要为了"看起来聪明"增加复杂性
- ❌ 不要做无法验证有效的变更
- ❌ 不要用模糊概念（"直觉"、"感觉"）作为理由
- ❌ 不要为新颖性牺牲稳定性

**优先级排序：**
> 稳定性 > 可解释性 > 可复用性 > 可扩展性 > 新颖性

### VFM Protocol (Value-First Modification)

**评分变更（加权）：**

| 维度 | 权重 | 问题 |
|------|------|------|
| 高频使用 | 3x | 这会每天用吗？ |
| 减少失败 | 3x | 这能把失败变成功吗？ |
| 用户负担 | 2x | 用户能否说 1 个词代替解释？ |
| 自身成本 | 2x | 这能为未来的我省 token/时间吗？ |

**阈值：** 加权分数 < 50 就不要做。

**黄金法则：**
> "这让未来的我能用更少成本解决更多问题吗？"

---

## 📊 与当前系统的对比

| 功能 | Proactive Agent v3.1 | 当前系统 (Claw) | 差距 |
|------|---------------------|----------------|------|
| WAL 协议 | ✅ 完整实现 | ⚠️ 部分实现（memory/*.md） | 需要 SESSION-STATE.md |
| 工作缓冲 | ✅ working-buffer.md | ❌ 无 | 需要添加 |
| 压缩恢复 | ✅ 完整流程 | ⚠️ 部分实现 | 需要标准化 |
| 孤立定时任务 | ✅ isolated agentTurn | ⚠️ 混合使用 | 需要审查 cron 配置 |
| 技能安装审查 | ✅  vetting 流程 | ✅ 已有 skill-vetter | ✅ 已对齐 |
| 顽强资源性 | ✅ 10 次尝试原则 | ⚠️ 有时过早求助 | 需要加强 |
| VFM 评分 | ✅ 量化评估 | ❌ 无 | 需要添加 |

---

## 🎯 可立即应用的改进

### 1. 创建 SESSION-STATE.md

```bash
touch ~/.openclaw/workspace/SESSION-STATE.md
```

用途：
- 记录当前活跃任务的详细状态
- WAL 协议的目标文件
- 每次会话开始时读取

### 2. 创建 working-buffer.md

```bash
touch ~/.openclaw/workspace/memory/working-buffer.md
```

用途：
- 上下文 >60% 时激活
- 记录每次交互
- 压缩后恢复上下文

### 3. 审查 cron 配置

检查所有定时任务：
- 后台工作是否使用 `isolated agentTurn`？
- 是否需要主会话交互的任务才用 `systemEvent`？

### 4. 添加强硬资源性检查

在 AGENTS.md 中添加：
```markdown
### 顽强资源性检查

在说"不能"或求助之前：
- [ ] 尝试了至少 5 种不同方法？
- [ ] 搜索了记忆中的类似案例？
- [ ] 考虑过组合工具的新方式？
```

### 5. 实施 VFM 评分

重大变更前先评分：
```markdown
**VFM 评分：**
- 高频使用 (0-10 × 3): __
- 减少失败 (0-10 × 3): __
- 用户负担 (0-10 × 2): __
- 自身成本 (0-10 × 2): __
- **总分:** __ / 100

阈值：≥50 才执行
```

---

## 📝 行动计划

### 本周内完成

- [ ] 创建 SESSION-STATE.md 模板
- [ ] 创建 working-buffer.md 模板
- [ ] 更新 AGENTS.md 添加顽强资源性检查
- [ ] 审查所有 cron 任务配置

### 本月内完成

- [ ] 实施 VFM 评分流程
- [ ] 添加工具迁移检查清单到 TOOLS.md
- [ ] 测试压缩恢复流程
- [ ] 文档化所有改进

---

## 💡 关键洞察

1. **"Text changes ≠ behavior changes"** - 改文字不等于改行为，必须改机制
2. **上下文是 BUFFER 不是存储** - 重要内容必须写文件
3. **60% 阈值是危险区** - 之后必须启动工作缓冲
4. **孤立任务才是真自主** - systemEvent 只是提示，isolated agentTurn 才执行
5. **顽强是身份不是选项** - 10 次尝试是底线不是目标

---

## 🔗 参考资料

- **Hal Stack:** https://github.com/hal-stack
- **作者:** Hal 9001 (@halthelobster)
- **ClawHub 技能:** `proactive-agent` v3.1.0

---

*调研报告完成时间：2026-03-28 00:30*
