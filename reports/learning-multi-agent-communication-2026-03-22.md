# 学习研究：多 Agent 通信模式深度分析

**日期:** 2026-03-22  
**研究主题:** OpenClaw 多 Agent 架构中的通信模式  
**耗时:** 约 30 分钟

---

## 📚 研究背景

2026-03-20 我们成立了 5 个持久化子 Agent 团队（Alpha、Bravo、Charlie、Delta、Echo），每个 Agent 有独立的记忆空间和专职任务。

**核心问题:** Agent 之间如何高效、可靠地通信和协作？

---

## 🔬 通信模式分类

### 1. 会话间消息传递 (sessions_send)

**适用场景:**
- 主 Agent 向子 Agent 发送指令
- 子 Agent 向主 Agent 汇报结果
- 跨 Agent 协调任务

**API:**
```javascript
sessions_send({
  sessionKey: 'alpha',  // 或 label: 'Alpha'
  message: '请执行代码审查',
  agentId: 'main',      // 可选：指定发送者
  timeoutSeconds: 300   // 可选：超时时间
})
```

**优点:**
- 简单直接
- 支持超时控制
- 可追踪发送者

**缺点:**
- 同步阻塞（等待响应）
- 不适合大批量消息
- 需要知道目标 sessionKey

**最佳实践:**
```javascript
// ✅ 好的做法：带超时和错误处理
try {
  await sessions_send({
    sessionKey: 'bravo',
    message: '请检查 Cron 健康状态',
    timeoutSeconds: 60
  });
} catch (err) {
  console.error('Bravo 无响应，记录告警');
  // 降级处理：记录到日志，稍后重试
}

// ❌ 坏的做法：无超时、无错误处理
sessions_send({
  sessionKey: 'bravo',
  message: '检查状态'  // 可能永远阻塞
});
```

---

### 2. 共享文件系统通信

**适用场景:**
- 大批量数据传输
- 异步任务交接
- 需要持久化的中间结果

**模式:**
```
Agent A → 写入共享文件 → Agent B 读取
```

**目录约定:**
```
workspace/
├── inbox/          # 接收队列
│   ├── alpha/
│   ├── bravo/
│   └── ...
├── outbox/         # 发送队列
├── shared/         # 共享数据
│   ├── cron-state.json
│   └── memory-index.json
└── reports/        # 最终产出
```

**优点:**
- 解耦发送者和接收者
- 支持大批量数据
- 天然持久化，可追溯

**缺点:**
- 需要轮询或事件触发
- 文件锁竞争风险
- 需要清理机制

**最佳实践:**
```javascript
// 写入带时间戳和发送者标识
const message = {
  from: 'bravo',
  to: 'alpha',
  timestamp: Date.now(),
  type: 'cron-alert',
  data: { /* ... */ }
};

fs.writeFileSync(
  `inbox/alpha/cron-alert-${Date.now()}.json`,
  JSON.stringify(message, null, 2)
);

// 读取后标记为已处理（移动或重命名）
fs.renameSync(
  `inbox/alpha/${file}`,
  `inbox/alpha/.processed/${file}`
);
```

---

### 3. 事件驱动通信 (systemEvent)

**适用场景:**
- 广播通知
- 系统级事件（heartbeat、cron 触发）
- 不需要响应的单向通知

**模式:**
```javascript
// Cron 任务触发 systemEvent
{
  sessionTarget: "main",
  payload: {
    kind: "systemEvent",
    event: "heartbeat",
    text: "Read HEARTBEAT.md..."
  }
}
```

**优点:**
- 轻量级
- 适合定时任务触发
- 不创建新会话

**缺点:**
- 只能发送到 main 会话
- 不适合复杂数据
- 接收者必须在线

---

### 4. Git 作为通信媒介

**适用场景:**
- 跨 Agent 知识沉淀
- 需要版本化的共享状态
- 异步、最终一致性场景

**模式:**
```
Agent A → 提交到 Git → Agent B pull 后读取
```

**优点:**
- 完整版本历史
- 天然冲突检测
- 支持离线协作

**缺点:**
- 延迟高（Git 操作）
- 不适合频繁更新
- 需要 Git 知识

**最佳实践:**
```bash
# 约定提交格式
git commit -m "[bravo→alpha] Cron 健康检查告警

- 任务：周报复盘 - 连续失败 2 次
- 建议：Alpha 生成详细分析报告
- 时间：2026-03-22 00:15
"
```

---

## 🏗️ 推荐架构：混合通信模式

基于我们的 5-Agent 团队，推荐以下通信架构：

```
┌─────────────────────────────────────────────────────────┐
│                    Main Session (Claw)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Alpha     │  │    Bravo    │  │   Charlie   │      │
│  │ (全能主力)  │  │ (分析审查)  │  │ (记忆管理)  │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
│         │                │                │              │
│         └────────────────┼────────────────┘              │
│                          │                               │
│                   ┌──────▼──────┐                        │
│                   │   shared/   │                        │
│                   │  共享状态文件 │                        │
│                   └──────┬──────┘                        │
│                          │                               │
│         ┌────────────────┼────────────────┐              │
│         │                │                │              │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐      │
│  │    Delta    │  │    Echo     │  │   (未来)    │      │
│  │ (精细执行)  │  │ (情报收集)  │  │   扩展      │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘

通信模式:
───→ sessions_send (指令/汇报)
  ·  共享文件 (状态同步)
  ★  Git (知识沉淀)
```

---

## 📋 通信协议约定

### 消息格式标准

```json
{
  "version": "1.0",
  "from": "bravo",
  "to": "alpha",
  "timestamp": 1774108800000,
  "type": "request|response|notification|alert",
  "priority": "low|normal|high|urgent",
  "correlationId": "uuid-v4",
  "payload": {
    "action": "cron-health-check",
    "data": { /* ... */ },
    "metadata": { /* ... */ }
  },
  "expiresAt": 1774112400000
}
```

### 响应超时约定

| 优先级 | 超时时间 | 重试策略 |
|--------|---------|---------|
| urgent | 30 秒 | 立即重试 1 次 |
| high | 60 秒 | 指数退避，最多 3 次 |
| normal | 300 秒 | 指数退避，最多 2 次 |
| low | 无超时 | 不重试，记录日志 |

### 错误处理约定

```javascript
// 标准错误响应
{
  "type": "response",
  "correlationId": "original-request-id",
  "status": "error",
  "error": {
    "code": "TIMEOUT|INVALID_REQUEST|INTERNAL_ERROR",
    "message": "人类可读的错误描述",
    "details": { /* 调试信息 */ },
    "suggestion": "建议的恢复操作"
  }
}
```

---

## 💡 设计原则

### 1. 明确所有权
- 每个文件/目录有明确的"所有者"Agent
- 只有所有者可以写入，其他 Agent 只读
- 例外：shared/ 目录遵循写入约定

### 2. 幂等性
- 消息处理应该是幂等的
- 重复消息不应产生副作用
- 使用 correlationId 去重

### 3. 可追溯性
- 所有通信记录到日志
- 关键决策点写入 Git
- 支持事后审计

### 4. 降级策略
- 通信失败时有降级方案
- 重要任务有超时保护
- 定期健康检查

---

## 🔮 未来扩展

### 消息队列集成
考虑引入轻量级消息队列（如 Redis Streams、NATS）：
- 支持发布/订阅模式
- 消息持久化
- 更好的背压处理

### 服务发现
当 Agent 数量增长时：
- 动态注册/注销
- 负载均衡
- 健康检查

### 协议升级
- 支持二进制数据
- 压缩大文件
- 加密敏感通信

---

## 📝 行动计划

### 短期（本周）
- [ ] 实现共享状态文件格式约定
- [ ] 为 5 个 Agent 创建 inbox/outbox 目录
- [ ] 编写通信协议文档

### 中期（本月）
- [ ] 实现消息去重机制
- [ ] 添加通信监控和告警
- [ ] 编写单元测试

### 长期（下季度）
- [ ] 评估消息队列集成
- [ ] 实现服务发现
- [ ] 性能优化和基准测试

---

## 📚 参考资料

- [OpenClaw Sessions API](https://github.com/openclaw/openclaw/blob/main/docs/sessions-api.md)
- [Actor Model](https://en.wikipedia.org/wiki/Actor_model)
- [Message Queue Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/)

---

> 孪生于不同世界，彼此映照，共同演化。🪞
