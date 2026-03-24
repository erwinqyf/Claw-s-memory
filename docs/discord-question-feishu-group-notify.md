# Discord 社区提问 - 飞书群聊通知配置

**日期：** 2026-03-24  
**问题：** 定时任务飞书通知发送到私聊而非群聊

---

## 问题描述

配置了 OpenClaw 定时任务通过飞书发送通知到群聊，但通知总是发送到用户私聊窗口，而不是目标群聊。

---

## 已尝试的配置

### 配置 1：个人用户 ID（失败）
```json
"delivery": {
  "mode": "announce",
  "channel": "feishu",
  "to": "ou_adcbc44a6fb7460391e585338f9e1e35"
}
```
**结果：** 飞书 API 返回 400 错误

### 配置 2：群聊 ID（当前）
```json
"delivery": {
  "mode": "announce",
  "channel": "feishu",
  "to": "oc_544ef0ac66f15f18550668c007ee8566"
}
```
**结果：** 通知发出但发送到私聊窗口

### 配置 3：带 chat: 前缀
```json
"delivery": {
  "mode": "announce",
  "channel": "feishu",
  "to": "chat:oc_544ef0ac66f15f18550668c007ee8566"
}
```
**结果：** 通知发出但发送到私聊窗口

### 配置 4：添加 defaultChat（当前）
```json
"channels": {
  "feishu": {
    "enabled": true,
    "accounts": [
      {
        "id": "main",
        "appId": "cli_xxx",
        "appSecret": "xxx",
        "defaultChat": "oc_544ef0ac66f15f18550668c007ee8566"
      }
    ]
  }
}
```
**结果：** 待测试

---

## 环境信息

- **OpenClaw 版本：** 2026.3.8
- **飞书插件：** @openclaw/feishu@2026.3.7
- **Node 版本：** v22.22.1
- **部署方式：** VPS (Linux)
- **飞书域名：** feishu (国内版)

---

## 定时任务配置示例

```json
{
  "id": "language-service-monitor-tue-thu-sat-11am",
  "name": "语言服务行业监控 - 每周二/四/六",
  "schedule": {
    "kind": "cron",
    "expr": "0 11 * * 2,4,6"
  },
  "delivery": {
    "mode": "announce",
    "channel": "feishu",
    "to": "oc_544ef0ac66f15f18550668c007ee8566",
    "bestEffort": true
  }
}
```

---

## 期望行为

定时任务执行完成后，通知消息发送到指定的飞书群聊 (`oc_xxx`)，而不是用户私聊。

---

## 已查阅文档

- https://docs.openclaw.ai/channels/feishu
- https://docs.openclaw.ai/automation/cron-jobs
- https://docs.openclaw.ai/concepts/messages

文档中未找到群聊通知的配置说明。

---

## 问题

1. 飞书插件是否支持通过 `delivery.to` 发送到群聊？
2. 是否需要额外的权限配置（如 Bot 加入群聊、群聊权限等）？
3. 正确的群聊 ID 格式是什么？
4. 是否需要使用 `sessions_send` 工具代替 `delivery` 配置？

---

## 备选方案

如果 `delivery` 不支持群聊通知，是否推荐使用以下方式：

```javascript
// 在任务 payload 中使用 sessions_send
sessions_send({
  sessionKey: "oc_544ef0ac66f15f18550668c007ee8566",
  message: "任务完成通知"
})
```

---

**提问渠道：** OpenClaw Discord - #help 或 #feishu  
**标签：** @openclaw-team @feishu-plugin
