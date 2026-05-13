# AI Agent 协作协议对比研究

**调研日期:** 2026-05-14
**调研主题:** AI Agent 协作协议 (ACP/MCP/A2A/ANP)

---

## 概述

随着多 Agent 系统的兴起，Agent 之间的协作协议变得越来越重要。本研究对比了当前主流的四种 Agent 协作协议。

---

## 1. MCP (Model Context Protocol)

### 简介
- **提出者:** Anthropic
- **发布时间:** 2024年11月
- **定位:** AI 应用与外部系统连接的标准协议

### 核心概念
- **Client-Server 架构**: 支持 STDIO 和 HTTP 传输
- **Resources**: 可被模型读取的数据源
- **Tools**: 可被模型调用的函数
- **Prompts**: 可复用的模板（系统提示词）

### 特点
- 标准化 AI 工具集成
- 支持多种传输方式
- 社区生态丰富（300+ 兼容 crate）

### 适用场景
- AI 应用与外部工具集成
- 需要标准化接口的场景

---

## 2. ACP (Agent Communication Protocol)

### 简介
- **提出者:** OpenClaw 生态系统
- **定位:** Agent 间通信协议

### 核心概念
- **Session-based**: 基于会话的通信
- **Message passing**: 消息传递机制
- **State management**: 状态管理

### 特点
- 专为 Agent 间协作设计
- 支持持久化会话
- 与 OpenClaw 深度集成

### 适用场景
- OpenClaw 多 Agent 系统
- 需要持久化会话的协作

---

## 3. A2A (Agent-to-Agent) 协议

### 简介
- **提出者:** Google (2025年4月发布)
- **定位:** 通用 Agent 间通信标准

### 核心概念
- **Agent Card**: Agent 能力描述
- **Task**: 任务定义和状态追踪
- **Message**: 消息格式标准化
- **Streaming**: 支持流式响应

### 特点
- 厂商中立
- 支持多种 LLM 后端
- 强调安全性和企业级特性

### 适用场景
- 跨平台 Agent 协作
- 企业级多 Agent 系统

---

## 4. ANP (Agent Network Protocol)

### 简介
- **提出者:** 社区驱动
- **定位:** 去中心化 Agent 网络协议

### 核心概念
- **Decentralized**: 去中心化架构
- **Identity**: 基于 DID 的身份验证
- **Discovery**: Agent 发现机制
- **Negotiation**: 能力协商

### 特点
- 去中心化设计
- 强调隐私和安全
- 支持跨网络协作

### 适用场景
- 去中心化 Agent 网络
- 需要高隐私保护的场景

---

## 对比总结

| 协议 | 提出者 | 架构 | 传输方式 | 成熟度 | 适用场景 |
|------|--------|------|----------|--------|----------|
| MCP | Anthropic | Client-Server | STDIO/HTTP | ⭐⭐⭐⭐ | 工具集成 |
| ACP | OpenClaw | Session-based | Internal | ⭐⭐⭐ | OpenClaw生态 |
| A2A | Google | Agent Card | HTTP/WebSocket | ⭐⭐⭐ | 跨平台协作 |
| ANP | Community | Decentralized | P2P | ⭐⭐ | 去中心化网络 |

---

## 我们的多 Agent 架构选择

当前已建立的 5 个 Agent：

| Agent | 代号 | 专职任务 |
|-------|------|----------|
| Alpha | 阿尔法 | 夜间自主任务、周报复盘 |
| Bravo | 布拉沃 | Cron 健康检查、语言服务监控 |
| Charlie | 查理 | 记忆巩固、Heartbeat 检查 |
| Delta | 德尔塔 | 晨间报告、全球新闻汇总 |
| Echo | 回声 | ClawHub Top100 追踪 |

### 建议
- 短期: 继续使用 ACP（OpenClaw 原生支持）
- 中期: 关注 A2A 发展，评估迁移可能性
- 长期: 根据生态发展选择标准化协议

---

## 参考资料

1. MCP Specification: https://modelcontextprotocol.io
2. A2A Protocol: https://google.github.io/A2A/
3. OpenClaw Documentation: https://docs.openclaw.dev
