# MCP (Model Context Protocol) 协议研究笔记

**调研日期:** 2026-05-01  
**调研时长:** 约 15 分钟  
**资料来源:** MCP 官方文档、Anthropic 博客、技术文章

---

## 1. MCP 概述

### 什么是 MCP？

MCP (Model Context Protocol) 是由 Anthropic 于 2024 年 11 月开源的开放协议标准，用于连接 AI 应用与外部系统。

**核心理念:** 就像 USB-C 为电子设备提供标准化连接方式，MCP 为 AI 应用提供标准化的外部系统连接方式。

### 为什么重要？

| 角色 | 收益 |
|------|------|
| **开发者** | 减少开发时间和复杂度，一次构建，到处集成 |
| **AI 应用** | 访问丰富的数据源、工具和应用生态 |
| **终端用户** | 更强大的 AI 助手，能访问个人数据并执行任务 |

---

## 2. MCP 架构

### 2.1 参与者 (Participants)

```
┌─────────────────────────────────────┐
│         MCP Host (AI 应用)           │
│  ┌─────────┐ ┌─────────┐           │
│  │Client 1 │ │Client 2 │ ...       │
│  └────┬────┘ └────┬────┘           │
└───────┼───────────┼─────────────────┘
        │           │
        ▼           ▼
┌─────────────┐ ┌─────────────┐
│ MCP Server A │ │ MCP Server B │
│ (本地文件)   │ │ (远程 API)   │
└─────────────┘ └─────────────┘
```

**三个核心角色:**
- **MCP Host**: AI 应用（如 Claude Desktop、VS Code、Claude Code）
- **MCP Client**: 与 MCP Server 保持连接，获取上下文
- **MCP Server**: 提供上下文数据的程序（可本地或远程运行）

### 2.2 两层架构

| 层级 | 职责 | 技术 |
|------|------|------|
| **数据层** | 定义 JSON-RPC 协议、生命周期管理、核心原语 | JSON-RPC 2.0 |
| **传输层** | 通信机制、连接建立、消息帧、授权 | STDIO / HTTP |

### 2.3 传输机制

1. **STDIO 传输**: 标准输入/输出流，用于本地进程通信
   - 性能最优，无网络开销
   - 适用于本地 MCP Server

2. **Streamable HTTP 传输**: HTTP POST + Server-Sent Events
   - 支持远程服务器通信
   - 支持标准 HTTP 认证（Bearer Token、API Key）
   - 推荐使用 OAuth 获取认证令牌

---

## 3. MCP 核心原语 (Primitives)

### 3.1 Server 原语（Server 暴露给 Client）

| 原语 | 说明 | 示例 |
|------|------|------|
| **Tools** | 可执行函数，AI 应用调用以执行操作 | 文件操作、API 调用、数据库查询 |
| **Resources** | 数据源，为 AI 应用提供上下文信息 | 文件内容、数据库记录、API 响应 |
| **Prompts** | 可复用模板，帮助构建与 LLM 的交互 | 系统提示词、few-shot 示例 |

### 3.2 Client 原语（Client 暴露给 Server）

| 原语 | 说明 | 方法 |
|------|------|------|
| **Sampling** | Server 请求 LLM 补全 | `sampling/createMessage` |
| **Elicitation** | Server 请求用户提供额外信息 | `elicitation/create` |
| **Logging** | Server 发送日志消息给 Client | - |

### 3.3 工具发现与执行流程

```
1. 初始化 (initialize)
   Client ──capabilities──> Server
   Server ──capabilities──> Client
   
2. 工具发现 (tools/list)
   Client ───────────────> Server
   Server ──tools[]──────> Client
   
3. 工具执行 (tools/call)
   Client ──name+args────> Server
   Server ──content──────> Client
```

---

## 4. 生命周期管理

### 4.1 初始化握手

**目的:**
1. **协议版本协商** - 确保双方使用兼容的协议版本
2. **能力发现** - 声明支持的特性（tools、resources、prompts）
3. **身份交换** - 提供标识和版本信息用于调试

**示例:**
```json
// Client 请求
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": { "elicitation": {} },
    "clientInfo": { "name": "example-client", "version": "1.0.0" }
  }
}

// Server 响应
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": {}
    },
    "serverInfo": { "name": "example-server", "version": "1.0.0" }
  }
}
```

### 4.2 实时通知 (Notifications)

Server 可以主动通知 Client 状态变化，无需 Client 轮询:

```json
// 工具列表变化通知
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}
// 注意: 没有 "id" 字段，因为通知不需要响应
```

---

## 5. 生态系统支持

### 5.1 已支持的客户端

- Claude Desktop
- Claude Code
- ChatGPT
- Visual Studio Code
- Cursor
- MCPJam
- Copilot Studio (Microsoft)

### 5.2 官方 Server 实现

- Filesystem (文件系统)
- Database (数据库)
- Git
- Sentry (错误追踪)
- 更多: https://github.com/modelcontextprotocol/servers

---

## 6. 关键洞察

### 6.1 与 OpenClaw Skills 的对比

| 特性 | MCP | OpenClaw Skills |
|------|-----|-----------------|
| **协议标准** | 开放标准，多厂商支持 | OpenClaw 专属 |
| **通信方式** | JSON-RPC 2.0 | 本地文件/函数调用 |
| **部署方式** | 本地 STDIO / 远程 HTTP | 本地文件系统 |
| **发现机制** | 动态 tools/list | 静态 skill 目录 |
| **生态规模** | 快速增长，社区活跃 | OpenClaw 生态 |

### 6.2 对 OpenClaw 的启示

1. **标准化价值** - MCP 证明了标准化协议在 AI 工具集成中的重要性
2. **动态发现** - 运行时工具发现比静态配置更灵活
3. **分层架构** - 数据层与传输层分离，支持多种部署模式
4. **能力协商** - 初始化时的能力声明避免了无效调用

### 6.3 潜在应用

- **OpenClaw 作为 MCP Client** - 连接外部 MCP Server 扩展能力
- **OpenClaw 作为 MCP Server** - 暴露 OpenClaw 功能给其他 AI 应用
- **混合架构** - 内部使用 Skills，外部使用 MCP

---

## 7. 参考资源

- **官方文档:** https://modelcontextprotocol.io/
- **协议规范:** https://modelcontextprotocol.io/specification/latest
- **官方 Servers:** https://github.com/modelcontextprotocol/servers
- **SDK 列表:** Python, TypeScript, Java, Kotlin 等
- **介绍文章:** https://www.anthropic.com/news/model-context-protocol

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
