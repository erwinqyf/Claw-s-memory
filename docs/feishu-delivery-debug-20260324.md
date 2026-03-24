# 飞书通知调试记录

**日期：** 2026-03-24 15:53

---

## 问题

定时任务配置了飞书通知，但通知发到了**错误的窗口**（私聊而非群聊）。

---

## 尝试过的配置格式

### 尝试 1：个人用户 ID
```json
"to": "ou_adcbc44a6fb7460391e585338f9e1e35"
```
**结果：** ❌ 飞书 API 返回 400 错误

### 尝试 2：群聊 ID（无前缀）
```json
"to": "oc_544ef0ac66f15f18550668c007ee8566"
```
**结果：** ⚠️ 通知发出但发到了私聊窗口

### 尝试 3：群聊 ID（chat: 前缀）
```json
"to": "chat:oc_544ef0ac66f15f18550668c007ee8566"
```
**结果：** ⚠️ 通知发出但发到了私聊窗口

---

## 根本原因

飞书插件的 `delivery.to` 参数可能不支持群聊 ID，或者需要额外的 `chatType: "group"` 参数。

---

## 解决方案

### 方案 A：修改飞书插件配置（推荐）
在 `~/.openclaw/openclaw.json` 的飞书账号配置中添加默认群聊：

```json
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
```

### 方案 B：修改任务配置
添加 `chatType` 参数（如果插件支持）：

```json
"delivery": {
  "mode": "announce",
  "channel": "feishu",
  "to": "oc_544ef0ac66f15f18550668c007ee8566",
  "chatType": "group"
}
```

### 方案 C：使用 sessions_send 代替
在任务 payload 中明确指定使用 `sessions_send` 发送到群聊。

---

## 下一步

1. 检查飞书插件文档，确认群聊通知的正确配置方式
2. 或者联系 OpenClaw 开发团队询问飞书群聊通知的正确用法
3. 临时方案：接受通知发到私聊，用户手动转发到群聊

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
