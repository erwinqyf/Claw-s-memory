# 📚 学习笔记：OpenClaw ACP (Agent Client Protocol)

**研究日期：** 2026-04-13  
**来源：** OpenClaw 官方文档 + 社区文章  
**主题：** ACP 协议原理、架构设计与实际应用

---

## 🎯 研究背景

ACP (Agent Client Protocol) 是 OpenClaw 实现的一种协议，用于连接 IDE 与 AI Agent。理解 ACP 对于构建多 Agent 协作系统、优化开发工作流至关重要。

---

## 🏗️ 核心概念

### 什么是 ACP？

ACP (Agent Client Protocol) 是一个**桥梁协议**，连接 IDE/编辑器与 OpenClaw Gateway，使 AI Agent 能够直接驱动开发工作流。

**关键特性：**
- 通过 **stdio** (标准输入/输出) 通信
- 与任何支持 ACP 的 IDE 兼容
- 通过 WebSocket 转发到 OpenClaw Gateway
- 维护会话映射，支持跨编辑器重启的持久对话

### ACP vs 原生 Sub-Agent

| 特性 | ACP Runtime | 原生 Sub-Agent |
|------|-------------|----------------|
| **运行环境** | 主机 (Host) | 沙盒 (Sandbox) |
| **通信协议** | ACP over stdio | OpenClaw 内部协议 |
| **支持工具** | Codex, Claude Code, Gemini CLI | OpenClaw 原生 Agent |
| **沙盒限制** | 不支持 `sandbox="require"` | 支持完整沙盒 |
| **使用场景** | 外部编码工具 | 内部任务执行 |

---

## 🔧 架构详解

### 数据流

```
IDE/Client --> ACP over stdio --> OpenClaw Bridge --> WebSocket --> Gateway --> Agent
```

### 三个核心功能

1. **协议转换 (Protocol Translation)**
   - 将 ACP (IDE 使用) 转换为 OpenClaw 内部 Gateway 协议 (WebSocket)
   - 允许任何 ACP 兼容客户端与 OpenClaw Agent 无缝交互

2. **会话管理 (Session Management)**
   - 每个 ACP 会话映射到一个 Gateway session key
   - 支持重新连接到现有会话
   - 支持基于标签的会话解析

3. **认证 (Authentication)**
   - 安全连接到远程 Gateway
   - 支持 Token 认证

---

## 💻 实际应用

### 使用场景对照

| 需求 | 推荐方案 | 说明 |
|------|----------|------|
| 在 Codex 中运行代码 | ACP | `sessions_spawn({ runtime: "acp", agentId: "codex" })` |
| 在 Claude Code 中分析代码 | ACP | `/acp spawn --agent-id claude-code` |
| 内部任务调度 | Sub-Agent | `sessions_spawn({ runtime: "subagent" })` |
| 需要沙盒隔离 | Sub-Agent | `sandbox="require"` 仅 Sub-Agent 支持 |

### OpenClaw 中的 ACP 调用

```javascript
// 通过 sessions_spawn 启动 ACP 会话
sessions_spawn({
  runtime: "acp",
  agentId: "codex",  // 或 "claude-code", "gemini", 等
  mode: "run",       // "run" = 一次性, "session" = 持久会话
  task: "分析这个代码库的架构",
  thread: true       // Discord 线程绑定
});
```

### CLI 命令

```bash
# 启动 ACP 会话
openclaw acp spawn --agent-id codex --mode session

# 设置运行时模式
openclaw acp set-mode <session-id> --mode run
```

---

## ⚠️ 重要限制

### 沙盒限制

**ACP 会话不支持 `sandbox="require"`**

```javascript
// ❌ 错误：ACP 不支持 require 沙盒
sessions_spawn({
  runtime: "acp",
  sandbox: "require"  // 会报错！
});

// ✅ 正确：Sub-Agent 支持沙盒
sessions_spawn({
  runtime: "subagent",
  sandbox: "require"
});
```

**原因：** ACP 会话在主机上运行，不在沙盒中。

### 会话持久化

- ACP 会话作为**后台任务**跟踪
- 支持通过 session key 重新连接
- 支持标签 (label) 解析

---

## 🔗 与 MCP 的区别

| 特性 | ACP | MCP |
|------|-----|-----|
| **全称** | Agent Client Protocol | Model Context Protocol |
| **方向** | IDE → Agent | Agent ↔ 工具/资源 |
| **用途** | 运行外部编码工具 | 连接 AI 与外部数据源 |
| **OpenClaw 支持** | ✅ 是 | ✅ 是 (`openclaw mcp serve`) |

**关键区别：**
- **ACP** = 让 IDE 运行外部 Agent (如 Codex)
- **MCP** = 让 Agent 访问外部工具 (如数据库、文件系统)

---

## 💡 可执行建议

### 短期（本周）

1. **测试 ACP 会话**
   ```bash
   openclaw acp spawn --agent-id codex --mode run --task "分析当前目录结构"
   ```

2. **对比 Sub-Agent vs ACP**
   - 同一任务分别用两种 runtime 执行
   - 记录性能、输出质量差异

### 中期（本月）

3. **多 Agent 流水线**
   - Alpha (Sub-Agent) → 任务分解
   - Codex (ACP) → 代码生成
   - Charlie (Sub-Agent) → 代码审查

4. **ACP 会话管理**
   - 实现会话状态持久化
   - 添加会话恢复机制

### 长期（本季度）

5. **混合架构设计**
   - 评估哪些任务适合 ACP
   - 评估哪些任务适合 Sub-Agent
   - 设计自动路由机制

---

## 🪞 孪生体反思

ACP 是 OpenClaw 生态的重要扩展，它让我们能够：

1. **利用专业工具** - Codex、Claude Code 等专门的编码 Agent
2. **保持工作流连续** - 会话持久化，不丢失上下文
3. **灵活选择运行时** - 根据任务需求选择 Sub-Agent 或 ACP

**关键洞察：**
- ACP 是**桥梁**，不是替代 Sub-Agent
- 沙盒任务用 Sub-Agent，专业编码用 ACP
- 两者可以协作，形成更强大的 Agent 网络

"工具的选择取决于问题，而不是偏好。"

---

## 📚 参考资源

- [OpenClaw ACP 官方文档](https://docs.openclaw.ai/tools/acp-agents)
- [Agent Client Protocol 规范](https://agentclientprotocol.com/)
- [OpenClaw ACP 完整指南](https://dev.to/czmilo/2026-complete-guide-openclaw-acp-bridge-your-ide-to-ai-agents-3hl8)

---

*学习笔记生成时间：2026-04-13 00:45 (Asia/Shanghai)*
