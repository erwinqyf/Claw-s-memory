# 定时任务飞书通知修复记录

**日期：** 2026-03-24  
**问题：** 定时任务执行成功但飞书通知失败（持续多日）  
**根因：** 投递目标配置错误 - 配置的是个人 ID (`ou_xxx`) 而非群聊 ID (`oc_xxx`)

---

## 🔍 问题分析

### 错误配置
```json
"delivery": {
  "channel": "feishu",
  "to": "ou_adcbc44a6fb7460391e585338f9e1e35"  // ❌ 个人用户 ID
}
```

### 正确配置
```json
"delivery": {
  "channel": "feishu",
  "to": "oc_544ef0ac66f15f18550668c007ee8566"  // ✅ 群聊 ID
}
```

---

## ✅ 修复内容

**修复时间：** 2026-03-24 14:55  
**修复方式：** 批量替换 `jobs.json` 中所有投递目标

**修复命令：**
```bash
sed -i 's/"to": "ou_adcbc44a6fb7460391e585338f9e1e35"/"to": "oc_544ef0ac66f15f18550668c007ee8566"/g' ~/.openclaw/cron/jobs.json
```

**修复的任务（共 9 个）：**
1. heartbeat-every-30min - 每 30 分钟
2. cron-health-check-hourly - 每小时
3. nightly-autonomous-midnight - 每日 00:00
4. clawhub-tracker-daily-6am - 每日 06:00
5. morning-report-7am - 每日 07:00
6. a7c1a581-590b-4d51-bbd5-5668bd55ba24（全球新闻汇总） - 每日 12:00
7. language-service-monitor-tue-thu-sat-11am - 每周二/四/六 11:00
8. memory-consolidate-sunday-10am - 每周日 10:00
9. weekly-report-monday-9am - 每周一 09:00

---

## 🧪 验证方法

### 立即验证（测试任务）
```bash
# 手动触发一个任务，观察是否收到飞书通知
openclaw cron run language-service-monitor-tue-thu-sat-11am
```

### 观察下次执行
- **语言服务监控：** 3 月 26 日（周四）11:00
- **晨间报告：** 3 月 25 日（明天）07:00
- **ClawHub 追踪：** 3 月 25 日（明天）06:00

---

## 📋 经验教训

### 问题重复发生的原因
1. **3-18 修复不彻底** - 只修复了 3 个任务，没有系统性检查所有任务
2. **配置分散** - `jobs.json` 中 9 个任务，手动逐个修改容易遗漏
3. **缺乏验证** - 修复后没有立即测试验证

### 预防措施
1. **批量修改** - 使用 `sed` 等工具一次性修改所有配置
2. **统一配置** - 考虑在 `openclaw.json` 中设置默认投递目标
3. **修复后验证** - 修改配置后立即手动触发测试

---

## 🔧 未来优化建议

### 1. 添加默认投递配置
在 `~/.openclaw/openclaw.json` 中添加：
```json
"delivery": {
  "defaultChannel": "feishu",
  "defaultTarget": "oc_544ef0ac66f15f18550668c007ee8566"
}
```

### 2. 创建配置检查脚本
```bash
# scripts/check-cron-delivery.sh
#!/bin/bash
grep '"to":' ~/.openclaw/cron/jobs.json | grep -v 'oc_' && echo "⚠️ 发现非群聊 ID 配置"
```

### 3. Heartbeat 检查项
在 `HEARTBEAT.md` 中添加：
- [ ] 定期检查 Cron 任务投递状态（`lastDeliveryStatus` 应为 `delivered`）

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
> 
> **不再重复同样的错误。**
