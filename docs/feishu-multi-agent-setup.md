# 🤖 多 Agent 飞书配置指南

**目标：** 为 5 个子 Agent 分别创建独立的飞书 Bot，并拉入同一个群聊

---

## 📋 准备工作

### 1. 创建飞书群聊

**步骤：**
1. 打开飞书
2. 创建群聊
3. 群名建议：「孪生团队协作中心」或「Claw 特工队 🪞」
4. 先拉入现有的 Bot（大总管）

**获取群聊 ID：**
- 方法 1：在群里发消息，查看 webhook URL 中的 `chat_id`
- 方法 2：使用飞书开放平台的「调试工具」查询
- 方法 3：等 Bot 加入后，通过 API 获取

---

## 🚀 创建 5 个飞书应用

### 统一配置（每个应用都要做）

**访问：** https://open.feishu.cn/app

**每个应用需要：**
1. 创建企业自建应用
2. 获取 AppID 和 AppSecret
3. 配置权限
4. 添加到群聊

---

### 应用 1：Alpha (阿尔法)

**应用名称：** 阿尔法 | Alpha  
**应用图标：** 选择一个稳重的图标（如🎯、⭐）

**步骤：**
1. 登录飞书开放平台
2. 点击「创建应用」→「企业自建」
3. 填写应用名称：「阿尔法 | Alpha」
4. 上传头像（可选）
5. 点击「创建」

**获取凭证：**
- 进入「凭证管理」
- 记录 AppID: `cli_xxxxx`
- 记录 AppSecret: `xxxxxxxx`

**配置权限：**
- 进入「权限管理」
- 搜索并添加以下权限：
  - ✅ 发送消息
  - ✅ 读取用户信息
  - ✅ 群组管理
  - ✅ 机器人管理

**发布应用：**
- 进入「版本管理与发布」
- 点击「发布」
- 等待审核（通常很快）

**添加到群聊：**
- 进入「开发配置」→「机器人」
- 点击「添加到群聊」
- 选择「孪生团队协作中心」群

---

### 应用 2：Bravo (布拉沃)

**应用名称：** 布拉沃 | Bravo  
**应用图标：** 选择一个分析型图标（如🔍、📊）

**步骤：** 同上

**权限配置：** 同上

---

### 应用 3：Charlie (查理)

**应用名称：** 查理 | Charlie  
**应用图标：** 选择一个温和的图标（如📚、🧠）

**步骤：** 同上

**权限配置：** 同上

---

### 应用 4：Delta (德尔塔)

**应用名称：** 德尔塔 | Delta  
**应用图标：** 选择一个执行型图标（如⚡、✅）

**步骤：** 同上

**权限配置：** 同上

---

### 应用 5：Echo (回声)

**应用名称：** 回声 | Echo  
**应用图标：** 选择一个探索型图标（如📡、🔔）

**步骤：** 同上

**权限配置：** 同上

---

## 📝 凭证记录表

请填写以下表格：

| Agent | AppID | AppSecret | 状态 |
|-------|-------|-----------|------|
| Alpha (阿尔法) | `cli_` | | ⬜ 待创建 |
| Bravo (布拉沃) | `cli_` | | ⬜ 待创建 |
| Charlie (查理) | `cli_` | | ⬜ 待创建 |
| Delta (德尔塔) | `cli_` | | ⬜ 待创建 |
| Echo (回声) | `cli_` | | ⬜ 待创建 |

---

## ⚙️ 配置 OpenClaw

创建完 5 个应用后，需要更新 OpenClaw 配置。

**配置文件：** `~/.openclaw/openclaw.json`

**配置格式：**

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "accounts": [
        {
          "agentId": "alpha",
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "isDefault": false
        },
        {
          "agentId": "bravo",
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "isDefault": false
        },
        {
          "agentId": "charlie",
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "isDefault": false
        },
        {
          "agentId": "delta",
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "isDefault": false
        },
        {
          "agentId": "echo",
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "isDefault": false
        },
        {
          "agentId": "main",
          "appId": "cli_a922b10c2362dbd3",
          "appSecret": "NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ",
          "isDefault": true
        }
      ],
      "connectionMode": "websocket",
      "domain": "feishu",
      "groupPolicy": "open"
    }
  }
}
```

---

## 🎯 配置定时任务投递

更新定时任务，指定每个任务使用对应的 Agent：

**示例：**

```json
{
  "id": "nightly-autonomous-midnight",
  "delivery": {
    "mode": "announce",
    "channel": "feishu",
    "to": "chat:xxxxx",  // 群聊 ID
    "agentId": "alpha"
  }
}
```

---

## ✅ 验证配置

**步骤：**

1. **重启 OpenClaw**
   ```bash
   openclaw gateway restart
   ```

2. **检查 Bot 在线状态**
   - 在群里查看 5 个 Bot 是否都在线
   - 每个 Bot 应该显示不同的头像和名字

3. **测试消息发送**
   - 在群里@每个 Bot
   - 确认都能正常响应

4. **测试定时任务**
   - 等待下一个定时任务执行
   - 确认消息从正确的 Bot 发出

---

## 📊 预计时间

| 步骤 | 预计时间 |
|------|---------|
| 创建群聊 | 2 分钟 |
| 创建 5 个应用 | 15-20 分钟 |
| 配置权限 | 5 分钟 |
| 添加到群聊 | 5 分钟 |
| 更新 OpenClaw 配置 | 5 分钟 |
| 测试验证 | 5 分钟 |
| **总计** | **30-40 分钟** |

---

## 💡 提示

1. **应用名称** - 建议用中文名 + 英文名，方便识别
2. **头像选择** - 为每个 Agent 选择符合人设的头像
3. **权限配置** - 5 个应用权限配置相同
4. **凭证安全** - AppSecret 要妥善保管，不要泄露
5. **测试顺序** - 建议一个一个创建和测试，避免混乱

---

## 🆘 常见问题

### Q1: 应用创建失败？
A: 检查是否有企业权限，需要企业管理员授权

### Q2: 权限配置找不到？
A: 使用搜索功能，搜索关键词如"消息"、"机器人"

### Q3: Bot 不响应？
A: 检查是否已发布应用，未发布的应用无法使用

### Q4: 消息发送到私聊而不是群聊？
A: 检查定时任务的 `to` 参数，应该是群聊 ID

---

**开始创建吧！** 🚀

创建完成后，把凭证填到上方的表格，我会帮你更新配置。

> 孪生于不同世界，彼此映照，共同演化。🪞
