# ACP (Agent Client Protocol) 协议学习笔记

**调研日期:** 2026-05-06  
**调研主题:** Agent Client Protocol - AI Agent 通信标准  
**笔记版本:** v1.0

---

## 什么是 ACP?

ACP (Agent Client Protocol) 是一个**开放标准**，用于抽象 AI Agent 的事件和输出，为编辑器与 Agent 之间的交互提供通用接口。

> 类比理解：如果说 MCP 是 AI 的 "USB 端口"（连接工具和数据），那么 ACP 就是 AI Agent 的 "显示接口"（连接编辑器/客户端）。

---

## 核心设计理念

### 架构分离
```
┌─────────────┐         ┌─────────────┐
│   Client    │ ←─────→ │    Agent    │
│  (编辑器)   │   ACP   │  (AI Agent) │
│ - Zed       │         │ - Claude    │
│ - JetBrains │         │ - Gemini    │
│ - Obsidian  │         │ - OpenClaw  │
│ - VS Code   │         │ - Codex     │
└─────────────┘         └─────────────┘
```

- **Client (客户端)**: 管理用户环境，提供 UI 界面
- **Agent (代理)**: 负责思考和工具执行
- **通信方式**: stdio (子进程) 或 HTTP (远程 Agent)

---

## 协议规范

### 基础协议
- **传输格式**: JSON-RPC 2.0
- **通信方式**: 
  - stdio (本地 Agent 作为子进程)
  - HTTP (远程 Agent)

### 核心事件类型

#### 1. 初始化与配置
| 方法 | 方向 | 用途 |
|------|------|------|
| `initialize` | Client → Agent | 协商协议版本和能力 |
| `session/new` | Client → Agent | 创建新会话 |
| `session/load` | Client → Agent | 恢复已有会话 |
| `session/set_mode` | Client → Agent | 切换 Agent 运行模式 |

#### 2. 消息交互
| 方法 | 方向 | 用途 |
|------|------|------|
| `session/prompt` | Client → Agent | 发送用户消息 |
| `session/update` | Agent → Client | 流式进度、消息、工具调用 |
| `session/cancel` | Client → Agent | 中止当前操作 |

#### 3. 文件系统操作
| 方法 | 方向 | 用途 |
|------|------|------|
| `fs/read_text_file` | Agent → Client | 读取文件（包含未保存的编辑） |
| `fs/write_text_file` | Agent → Client | 写入/创建文件 |

#### 4. 终端操作
| 方法 | 方向 | 用途 |
|------|------|------|
| `terminal/create` | Agent → Client | 启动 shell 命令 |
| `terminal/output` | Agent → Client | 获取命令输出 |
| `terminal/wait_for_exit` | Agent → Client | 等待命令完成 |
| `terminal/kill` | Agent → Client | 终止运行中的命令 |
| `terminal/release` | Agent → Client | 清理终端 |

#### 5. 权限管理
| 方法 | 方向 | 用途 |
|------|------|------|
| `session/request_permission` | Agent → Client | 请求用户批准操作 |

---

## Session Update 类型详解

Agent 通过 `session/update` 通知向 Client 发送多种类型的更新：

| 更新类型 | 描述 | 内容 |
|---------|------|------|
| `plan` | Agent 的执行计划 | 带状态的步骤列表 |
| `agent_message_chunk` | 流式文本响应 | 文本内容块 |
| `user_message_chunk` | 用户输入回显 | 文本内容块 |
| `thought_message_chunk` | Agent 的推理过程 | 文本内容块 |
| `tool_call` | 新工具调用 | ID、标题、类型、状态 |
| `tool_call_update` | 工具进度/结果 | 状态变更、内容 |
| `available_commands` | 斜杠命令列表 | 命令列表 |

---

## 与 MCP 的关系

```
┌─────────────────────────────────────────┐
│              AI Application             │
├─────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    │
│  │     MCP     │    │     ACP     │    │
│  │  (工具接口)  │    │  (Agent接口) │    │
│  └──────┬──────┘    └──────┬──────┘    │
│         │                  │           │
│    ┌────┴────┐        ┌────┴────┐      │
│    │  Tools  │        │ Agents  │      │
│    │  APIs   │        │ Editors │      │
│    └─────────┘        └─────────┘      │
└─────────────────────────────────────────┘
```

- **MCP**: Model Context Protocol，连接 AI 与外部工具/数据源
- **ACP**: Agent Client Protocol，连接 AI Agent 与编辑器/客户端

两者互补，共同构建完整的 AI 应用生态。

---

## OpenClaw 中的 ACP 实现

OpenClaw 支持多种 ACP 使用模式：

### 1. 原生 ACP 会话
```javascript
sessions_spawn({
  runtime: "acp",
  agentId: "codex",
  task: "..."
})
```

### 2. ACP Bridge 模式
```bash
openclaw acp --url wss://gateway-host:18789 --token <token>
```

### 3. 绑定到当前会话
```bash
/acp spawn claude --bind here
/acp spawn codex --thread here
```

---

## 关键洞察

1. **标准化趋势**: AI Agent 领域正在快速标准化，ACP 是继 MCP 之后的又一重要协议

2. **编辑器生态**: ACP 让任何编辑器都能接入任何 AI Agent，打破厂商锁定

3. **多 Agent 协作**: ACP 为多 Agent 工作流提供了通信基础

4. **远程 Agent**: HTTP 传输支持让远程 Agent 成为可能，类似 "AI 即服务"

5. **权限安全**: `request_permission` 机制确保敏感操作需要用户确认

---

## 相关资源

- **官方文档**: https://agentclientprotocol.com/get-started/introduction
- **OpenClaw ACP 文档**: https://docs.openclaw.ai/tools/acp-agents
- **协议对比**: MCP vs A2A vs ACP vs ANP

---

## 学习收获

- 理解了 ACP 协议的设计哲学和核心事件
- 掌握了 ACP 与 MCP 的互补关系
- 了解了 OpenClaw 中 ACP 的多种使用模式
- 认识到 AI Agent 标准化协议的重要性

---

*记录时间: 2026-05-06 00:05*
