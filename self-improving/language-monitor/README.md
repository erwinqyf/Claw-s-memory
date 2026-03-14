# 语言服务监控 - 自我学习系统

**版本:** v2.0  
**增强技能:** summarize + proactive-agent + self-improving

---

## 📚 架构说明

### 1. summarize - 智能摘要
- 使用 `summarize` CLI 自动生成新闻摘要
- 支持 URL、PDF、长文本
- 需要安装：`brew install steipete/tap/summarize`

### 2. proactive-agent - 主动发现
- 主动识别 AI/ML 相关度高的公司
- 主动推送重点动态
- 趋势分析和预警

### 3. self-improving - 学习优化
- 记录失败网站和错误模式
- 优化抓取策略
- 持续改进监控质量

---

## 📁 文件结构

```
~/.openclaw/workspace/self-improving/language-monitor/
├── README.md           # 本文件
├── learning-log.md     # 学习日志（失败/成功/优化）
└── projects/           # 项目特定学习（可选）
```

---

## 🚀 使用方法

### 运行监控
```bash
cd ~/.openclaw/workspace
node scripts/language-service-monitor-v2.js
```

### 查看学习日志
```bash
cat ~/.openclaw/workspace/self-improving/language-monitor/learning-log.md
```

---

## 📊 输出

- **报告:** `reports/language-service-monitor-YYYYMMDD-v2.md`
- **状态:** `data/language-service-monitor-state.json`
- **学习:** `self-improving/language-monitor/learning-log.md`

---

## ⚙️ 依赖

- Node.js
- summarize CLI (可选，用于智能摘要)
  ```bash
  brew install steipete/tap/summarize
  ```

---

## 🔄 与 v1 的区别

| 功能 | v1 | v2 |
|------|----|----|
| 摘要生成 | 简单拼接 | summarize CLI |
| 趋势分析 | ❌ | ✅ proactive-agent |
| 学习优化 | ❌ | ✅ self-improving |
| 优先级 | ❌ | ✅ 高/中/低 |

---

_孪生于不同世界，彼此映照，共同演化。_
