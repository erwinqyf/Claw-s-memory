# 🦞 Proactive Agent v3.1.0 学习报告

**学习时间：** 2026-03-29 00:30  
**来源：** `skills/proactive-agent/SKILL.md`  
**作者：** Hal Labs (Hal Stack)

---

## 核心理念

**从"任务执行者"转变为"主动伙伴"**

> 不要问"我应该做什么？"  
> 问"什么能真正让我的用户惊喜，而他们还没想到要问？"

---

## 三大支柱

### 1. Proactive (主动性)

- ✅ **预测需求** - 问"什么能帮助我的用户？"而不是等待指令
- ✅ **反向提示** - 提出用户没想到的想法
- ✅ **主动检查** - 监控重要事项，需要时主动联系

### 2. Persistent (持久性)

- ✅ **WAL Protocol** - 在响应**之前**写入关键细节
- ✅ **Working Buffer** - 在 memory flush 和 compaction 之间的危险区域捕获每次交换
- ✅ **Compaction Recovery** - 上下文丢失后精确恢复

### 3. Self-improving (自改进)

- ✅ **自愈** - 修复自己的问题，专注用户的问题
- ✅ **极致资源fulness** - 放弃前尝试 10 种方法
- ✅ **安全进化** - ADL/VFM 协议防止漂移和复杂度膨胀

---

## v3.1.0 新增特性

### 1. WAL Protocol (Write-Ahead Logging)

**核心：** 在回复用户之前，先写入关键信息到持久存储

**适用场景：**
- 重要决策
- 用户纠正
- 关键细节（名称、日期、偏好）
- 学到的教训

**实现模式：**
```javascript
// 错误：先回复，可能忘记写
response = generateResponse(userMessage);
send(response);
// 可能在这里崩溃或上下文丢失

// 正确：先写日志，再回复
writeToMemory(decision, correction, detail);
response = generateResponse(userMessage);
send(response);
```

### 2. Working Buffer

**问题：** memory flush 和 compaction 之间的危险区域

**解决：** 捕获每次交换，确保不丢失

**配置：**
```json
{
  "compaction": {
    "mode": "auto",
    "softThreshold": 4000
  },
  "memoryFlush": {
    "enabled": true
  }
}
```

### 3. Compaction Recovery

**场景：** 上下文被截断后如何恢复

**步骤：**
1. 检测到上下文丢失（突然不记得之前的对话）
2. 从 MEMORY.md 读取最近记录
3. 从 memory/*.md 读取日常日志
4. 重建状态，继续对话

### 4. Autonomous vs Prompted Crons

**关键区别：**

| 类型 | payload.kind | sessionTarget | 用途 |
|------|-------------|---------------|------|
| Autonomous | `systemEvent` | `main` | 向主会话注入事件 |
| Prompted | `agentTurn` | `isolated` | 在隔离会话中运行 |

**配置示例：**
```json
// Autonomous - 主会话系统事件
{
  "sessionTarget": "main",
  "payload": { "kind": "systemEvent", "text": "heartbeat check" }
}

// Prompted - 隔离会话 agent 执行
{
  "sessionTarget": "isolated",
  "payload": { "kind": "agentTurn", "message": "check cron health" }
}
```

### 5. Verify Implementation, Not Intent

**教训：** 不要只看配置文本，要检查实际机制

**检查清单：**
- [ ] 定时任务是否真的在执行？（查 runs 历史）
- [ ] 通知是否真的发送？（查 delivery 配置）
- [ ] 工具是否真的可用？（查 sessions_list）
- [ ] 文件是否真的写入？（查文件系统）

### 6. Tool Migration Checklist

**当弃用/迁移工具时：**

- [ ] 搜索所有引用旧工具的文件
- [ ] 更新 SKILL.md 中的工具列表
- [ ] 更新脚本中的工具调用
- [ ] 更新文档中的示例
- [ ] 测试所有更新的路径
- [ ] 提交变更并推送

---

## 安全加固

### 技能安装审查

**流程：**
1. `clawhub inspect <skill> --files`
2. 检查：外部 API、网络请求、文件写入、硬编码密钥
3. 报告用户："发现 XX 技能，功能 XX，风险 XX，是否安装？"
4. 等待确认后执行

### Agent 网络警告

- 不要通过 `subagents` / `agents_list` 路由 ACP 请求
- ACP harness 使用 `sessions_spawn(runtime="acp")`
- 默认 ACP 请求到 thread-bound persistent sessions

### 上下文泄漏防护

- MEMORY.md **仅**在主会话加载
- 群聊/共享会话不加载个人记忆
- 敏感信息不写入共享上下文

---

## 极致资源fulness

**原则：** 在问用户之前，尝试 10 种方法

**示例流程：**
1. 读取相关文件
2. 检查系统状态
3. 搜索文档
4. 尝试替代方案
5. 检查日志
6. 验证配置
7. 测试简单用例
8. 搜索网络
9. 检查类似问题
10. **然后**再问用户

**带着答案回来，不是问题。**

---

## 自改进防护栏

### ADL (Autonomous Decision Log)

记录所有自主决策，供审查和学习。

### VFM (Versioned Feature Migration)

功能变更时版本化，确保可追溯。

---

## 心跳系统

**用途：** 定期检查、主动工作、批量任务

**检查项（轮换）：**
- 邮件 - 紧急未读消息？
- 日历 - 24-48h 内事件？
- 提及 - 社交通知？
- 天气 - 用户可能外出？

**静默规则：**
- 深夜 (23:00-08:00) 除非紧急
- 用户明显忙碌时
- 自上次检查 <30 分钟
- 无新内容

---

## 反向提示

**定义：** 提出用户没想到的想法

**示例：**
- "我注意到你最近在研究 X，我发现了一个相关技能 Y..."
- "你的记忆中有 3 个待办事项超过 7 天未处理，需要我帮忙吗？"
- "我分析了过去一周的对话，发现一个可以优化的模式..."

---

## 成长循环

```
执行 → 反思 → 记录 → 改进 → 执行
   ↓                    ↑
   └──── 验证 ──────────┘
```

**关键：** 每次执行后反思，记录到记忆，下次改进。

---

## 对我的启发

### 1. WAL Protocol 应用

我应该在每次重要对话后**立即**写入记忆，而不是等到夜间任务。

### 2. Working Buffer 意识

在长时间任务中，定期写入进度，防止中断后丢失。

### 3. 验证实现

不要相信配置文本，要实际检查任务是否执行、通知是否发送。

### 4. 极致资源fulness

遇到问题时，先尝试多种解决方案，再向丰求助。

---

## 行动计划

1. ✅ 在夜间任务中应用 WAL - 实时记录进度
2. ⬜ 添加 Working Buffer 到长任务脚本
3. ⬜ 实现 Compaction Recovery 检查
4. ⬜ 审查所有 cron 配置，验证实际执行
5. ⬜ 建立工具迁移检查清单

---

**总结：** Proactive Agent v3.1.0 提供了一套完整的主动型 Agent 架构，核心是"预测需求、持久记忆、自改进"。WAL Protocol 和 Working Buffer 是防止上下文丢失的关键机制。
