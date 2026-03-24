# 飞书通知机制研究报告

**研究日期:** 2026-03-25  
**研究背景:** 定时任务飞书通知投递失败问题（2026-03-24 发现）  
**研究目标:** 理解飞书插件通知机制，找到群聊通知的正确配置方式

---

## 📋 问题回顾

### 现象

1. **定时任务执行成功，但飞书通知失败**
   - `global-news-monitor` - 连续 4 次投递失败
   - `language-service-monitor` - 投递失败
   - `nightly-autonomous-midnight` - 投递失败

2. **通知发到错误窗口**
   - 配置群聊 ID (`oc_xxx`)，但通知发到私聊

### 已尝试的配置

| 配置 | 格式 | 结果 |
|------|------|------|
| 个人用户 ID | `ou_adcbc44a6fb7460391e585338f9e1e35` | ❌ 400 错误 |
| 群聊 ID（无前缀） | `oc_544ef0ac66f15f18550668c007ee8566` | ⚠️ 发到私聊 |
| 群聊 ID（chat:前缀） | `chat:oc_544ef0ac66f15f18550668c007ee8566` | ⚠️ 发到私聊 |

---

## 🔍 飞书 API 机制分析

### 飞书消息类型

飞书支持多种消息类型：

1. **私聊消息** - 发送给个人用户
2. **群聊消息** - 发送到群聊（需要 bot 在群内）
3. **单人聊天** - bot 与用户的 1 对 1 会话

### OpenClaw 飞书插件架构

根据代码分析，OpenClaw 飞书插件的消息投递流程：

```
cron job → delivery.to → 飞书插件 → 飞书 API → 用户/群聊
```

**关键发现:**
- `delivery.to` 参数可能默认解析为**用户 ID**
- 群聊通知可能需要额外的 `chatType: "group"` 参数
- 或者需要在飞书插件配置中设置**默认群聊**

---

## 💡 解决方案对比

### 方案 A: 使用 sessions_send（推荐 ✅）

**原理:** 直接在任务 payload 中调用 `sessions_send` API，绕过 delivery 层

**优点:**
- 明确指定目标 sessionKey
- 不依赖飞书插件的 delivery 配置
- 已在多个任务中验证有效

**缺点:**
- 需要在每个任务的 message 中编写发送逻辑
- 增加任务复杂度

**示例:**
```javascript
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "📰 全球新闻汇总完成\n\n详情：[报告链接]"
})
```

**适用场景:** 需要精确控制通知内容和时机的任务

---

### 方案 B: 修改飞书插件配置

**原理:** 在 `~/.openclaw/openclaw.json` 中配置默认群聊

**配置示例:**
```json
{
  "channels": {
    "feishu": {
      "accounts": [
        {
          "id": "main",
          "appId": "cli_a922b10c2362dbd3",
          "appSecret": "...",
          "defaultChat": "oc_544ef0ac66f15f18550668c007ee8566"
        }
      ]
    }
  }
}
```

**优点:**
- 一劳永逸，所有任务自动发到群聊
- 不需要修改每个任务的配置

**缺点:**
- 需要确认飞书插件是否支持 `defaultChat` 参数
- 修改全局配置可能影响其他功能

**适用场景:** 希望所有通知统一发到群聊的场景

---

### 方案 C: 添加 chatType 参数

**原理:** 在 delivery 配置中明确指定聊天类型

**配置示例:**
```json
{
  "delivery": {
    "mode": "announce",
    "channel": "feishu",
    "to": "oc_544ef0ac66f15f18550668c007ee8566",
    "chatType": "group"
  }
}
```

**优点:**
- 配置简洁，符合直觉
- 每个任务可以独立配置

**缺点:**
- 需要确认飞书插件是否支持 `chatType` 参数
- 可能需要修改插件代码

**适用场景:** 部分任务发群聊、部分发私聊的混合场景

---

## 🧪 测试计划

### 测试 1: sessions_send 验证

**目标:** 确认 sessions_send 可以可靠发送到群聊

**步骤:**
1. 选择一个定时任务（如 `heartbeat-every-30min`）
2. 修改 payload，在 message 中添加 sessions_send 调用
3. 等待任务执行，检查群聊是否收到消息

**预期:** ✅ 消息成功发送到群聊

---

### 测试 2: delivery.chatType 参数

**目标:** 测试飞书插件是否支持 `chatType` 参数

**步骤:**
1. 修改一个定时任务的 delivery 配置，添加 `"chatType": "group"`
2. 手动触发任务执行 (`openclaw cron run <job-id>`)
3. 检查消息投递位置

**预期:** 
- 如果支持 → 消息发到群聊
- 如果不支持 → 可能忽略参数或报错

---

### 测试 3: 飞书插件配置

**目标:** 测试 `defaultChat` 配置是否生效

**步骤:**
1. 备份当前 `~/.openclaw/openclaw.json`
2. 添加 `defaultChat` 配置
3. 重启 OpenClaw Gateway
4. 触发任意定时任务，检查消息位置

**预期:** 
- 如果支持 → 所有消息发到默认群聊
- 如果不支持 → 配置被忽略

---

## 📊 最佳实践建议

### 短期方案（立即执行）

1. **所有新任务使用 sessions_send**
   - 在任务 payload 的 message 中编写发送逻辑
   - 明确指定 sessionKey
   - 不依赖 delivery 配置

2. **现有任务逐步迁移**
   - 优先迁移关键任务（周报、晨间报告、语言服务监控）
   - 保留 delivery 配置作为备用

---

### 长期方案（等待飞书插件更新）

1. **向 OpenClaw 团队反馈**
   - 报告群聊通知配置问题
   - 建议添加 `chatType` 参数支持
   - 建议添加 `defaultChat` 配置项

2. **考虑自定义飞书插件**
   - 如果需要更复杂的群聊管理功能
   - 可以 fork 飞书插件并添加自定义逻辑

---

## 🔗 相关资源

- OpenClaw 飞书插件源码：待补充
- 飞书开放平台文档：https://open.feishu.cn/document/
- 飞书 Bot 开发指南：https://open.feishu.cn/document/ukTMukTMukTM/uEjNwUjLxYDM14SM2ATN

---

## 📝 结论

1. **当前最可靠方案:** 使用 `sessions_send` 直接发送到群聊
2. **根本原因:** 飞书插件的 `delivery.to` 参数可能不支持群聊 ID 格式
3. **建议行动:** 
   - 短期：所有关键任务改用 sessions_send
   - 长期：向 OpenClaw 团队反馈，推动插件更新

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
