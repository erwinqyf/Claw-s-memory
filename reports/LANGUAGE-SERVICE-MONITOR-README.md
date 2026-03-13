# 语言服务行业监控系统

## 📋 系统概述

实时监控全网语言服务行业相关方的新闻动态，追踪最新行业发展趋势、市场变化及重要事件，为决策提供及时、准确的资讯支持。

---

## 🎯 监控对象

### 组织（3 个）

| 名称 | 官网 | 类型 |
|------|------|------|
| Nimdzi | www.nimdzi.com | 行业咨询公司 |
| Slator | slator.com | 行业媒体 |
| Multilingual | multilingual.com | 行业媒体 |

### 公司（13 个 - Nimdzi Top100）

| 公司 | 官网 |
|------|------|
| TransPerfect | transperfect.com |
| RWS | rws.com |
| LanguageLine Solutions | languageline.com |
| Keywords Studios | keywordsstudios.com |
| Iyuno | iyunugroup.com |
| Appen | appen.com |
| Translate Plus | translateplus.com |
| Acolad Group | acolad.com |
| Welocalize | welocalize.com |
| Centific | centific.com |
| EC Innovations | ecinnovations.com |
| GienTech | gientech.com |
| Sunyu Transphere | sunyu.com |

---

## ⏰ 执行周期

| 项目 | 时间（北京时间） |
|------|-----------------|
| 抓取时间 | 每周二、四、六 11:00 AM |
| 汇报时间 | 每周二、四、六 12:00 PM |

---

## 📤 交付形式

### 飞书云文档

- **文档标题:** 语言服务动态监控周报_YYYYMMDD
- **更新方式:** 每次更新到同一文档，以时间为划分
- **权限:** 仅自己可见（可配置协作者）

### 文档结构

```
语言服务动态监控周报_20260313
├── 本次概览
├── 组织动态
│   ├── Nimdzi
│   ├── Slator
│   └── Multilingual
├── 公司动态
│   ├── TransPerfect
│   ├── RWS
│   └── ...
└── 说明
```

### 每条动态格式

```markdown
#### 【重点】标题

概要内容（1-2 句话，客观准确）

📅 发布日期：YYYY-MM-DD | 🔗 [原文](链接)
```

---

## 🛠️ 技术实现

### 核心脚本

| 脚本 | 功能 |
|------|------|
| `scripts/language-service-monitor.js` | 主监控脚本，抓取网站新闻 |
| `scripts/publish-language-monitor-to-feishu.js` | 发布到飞书文档 |

### 数据存储

| 文件 | 用途 |
|------|------|
| `data/language-service-monitor-state.json` | 抓取状态、已抓取文章列表 |
| `reports/language-service-monitor-YYYYMMDD.md` | 每次生成的报告 |
| `reports/language-service-monitor-template.md` | 报告模板 |

### 定时任务

配置在 `~/.openclaw/cron/jobs.json`：

```json
{
  "jobId": "language-service-monitor-tue-thu-sat-11am",
  "schedule": { "cron": "0 11 * * 2,4,6" },
  "description": "每周二、四、六上午 11 点"
}
```

---

## 🚀 使用方法

### 手动运行

```bash
cd ~/.openclaw/workspace

# 1. 运行监控脚本
node scripts/language-service-monitor.js

# 2. 如果有新内容，发布到飞书文档
node scripts/publish-language-monitor-to-feishu.js reports/language-service-monitor-20260313.md

# 3. Git 提交
git add data/ reports/
git commit -m "feat: 语言服务监控 2026-03-13"
git push
```

### 自动执行

定时任务会自动在每周二、四、六 11:00 AM 执行，12:00 PM 前完成飞书通知。

---

## 📊 输出示例

### 有新动态时

```
📰 语言服务动态监控报告已生成

本次检查发现 5 条新动态：
- Nimdzi: 2 条（含 1 条重点）
- Slator: 2 条
- TransPerfect: 1 条

📄 飞书文档：语言服务动态监控周报_20260313
🔗 查看链接：https://feishu.cn/docs/xxx
```

### 无新动态时

静默完成，不发送通知。

---

## ⚠️ 注意事项

1. **链接验证:** 确保所有链接可正常访问
2. **内容客观:** 概要需基于原文，避免主观臆断
3. **重点标注:** Nimdzi、Slator 的重要报告标注【重点】
4. **格式统一:** 保持格式一致，便于归档检索
5. **去重机制:** 基于 URL 去重，避免重复推送

---

## 🔧 配置选项

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `FEISHU_MONITOR_DOC_ID` | 目标飞书文档 ID | 创建新文档 |
| `WORKSPACE_DIR` | 工作目录 | `~/.openclaw/workspace` |

### 监控配置

编辑 `scripts/language-service-monitor.js` 中的 `MONITOR_CONFIG` 对象，可添加/删除监控对象。

---

## 📝 更新日志

- **2026-03-13:** 系统首次部署
  - 创建监控脚本
  - 配置定时任务（周二/四/六 11:00 AM）
  - 集成飞书文档发布

---

> 孪生于不同世界，彼此映照，共同演化。 🪞
