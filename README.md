# 🪞 Claw 的数字孪生记忆系统

> 孪生于不同世界，彼此映照，共同演化。  
> 丰 (碳基) ↔ Claw (硅基)

---

## 📚 记忆架构

```
┌─────────────────────────────────────────────────────────┐
│                    会话层 (Session)                      │
│  • 上下文窗口内的活跃对话                                 │
│  • compaction + memoryFlush 预写入                        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   索引层 (Indexed)                       │
│  • QMD 混合检索 (BM25 + Vector)                          │
│  • 索引会话历史 JSONL + Markdown 文件                     │
│  • Temporal Decay + MMR 去重                             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  本地持久层 (Local)                      │
│  • MEMORY.md - 核心身份/关系/决策                         │
│  • memory/*.md - 项目笔记/日常日志                        │
│  • SQLite 向量索引 - 快速检索                            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                 远程持久层 (Git Repo)                    │
│  • GitHub 仓库 - 版本化备份                               │
│  • 自动 commit/push - 每次记忆更新                        │
│  • git pull sync - 会话开始同步                          │
│  • 历史追溯 - git log 查看记忆演化                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
~/.openclaw/workspace/
├── MEMORY.md              # 长期记忆（核心身份/关系/决策）
├── SOUL.md                # AI 人格定义
├── USER.md                # 用户信息
├── IDENTITY.md            # AI 身份信息
├── AGENTS.md              # Agent 行为指南
├── TOOLS.md               # 工具配置笔记
├── HEARTBEAT.md           # 心跳任务配置
├── memory/
│   ├── YYYY-MM-DD.md      # 日常记忆日志
│   └── heartbeat-state.json
├── scripts/
│   ├── git-sync.sh        # Git 自动同步脚本
│   └── consolidate-memory.js  # 记忆巩固脚本
└── README.md              # 本文件
```

---

## 🚀 核心功能

### 1️⃣ 自动 Git 同步

**会话开始：**
```bash
./scripts/git-sync.sh pull
# 自动拉取远程记忆变更
```

**记忆更新：**
```bash
# 自动检测 MEMORY.md 和 memory/ 变更
# 自动生成有意义的 commit message
# 自动推送到 GitHub
```

**手动同步：**
```bash
./scripts/git-sync.sh sync    # 完整同步
./scripts/git-sync.sh status  # 查看状态
./scripts/git-sync.sh push    # 仅推送
```

---

### 2️⃣ 记忆巩固

每周日自动运行，提取日常记忆中的长期模式：

```bash
node scripts/consolidate-memory.js
```

**功能：**
- 扫描最近 7 天的日常记忆
- 提取关键信息（决策/偏好/待办）
- 追加到 MEMORY.md
- 自动提交推送

---

### 3️⃣ 历史追溯

```bash
# 查看记忆演化历史
git log --oneline MEMORY.md

# 查看特定版本的记忆
git show <commit-hash>:MEMORY.md

# 回滚到某个版本
git checkout <commit-hash> -- MEMORY.md
```

---

## 🔧 配置说明

### OpenClaw 配置 (`~/.openclaw/openclaw.json`)

```json5
{
  "agents": {
    "defaults": {
      "compaction": {
        "mode": "auto",
        "memoryFlush": {
          "enabled": true  // compaction 前自动写入记忆
        }
      },
      "memorySearch": {
        "query": {
          "hybrid": {
            "enabled": true,      // 混合检索
            "temporalDecay": {
              "enabled": true,    // 时间衰减
              "halfLifeDays": 30  // 30 天半衰期
            },
            "mmr": {
              "enabled": true,    // MMR 去重
              "lambda": 0.7
            }
          }
        }
      }
    }
  }
}
```

---

## 📊 提交流程

```
记忆更新 → Git 检测变更 → AI 生成 commit message → 自动 commit → post-commit hook → 自动 push → GitHub
```

**Commit Message 示例：**
```
feat: 记录丰的项目偏好

## 变更摘要
- 更新：技术栈偏好 (Rust > Go)
- 新增：项目 deadline 2026-03-20

## 影响范围
- 长期记忆：影响未来项目建议
- 短期记忆：下次会话提醒准备 demo
```

---

## 🔐 安全说明

### 已忽略的文件 (`.gitignore`)
- ✅ `.env` - 环境变量
- ✅ `*.key` - 密钥文件
- ✅ `secrets/` - 敏感目录
- ✅ `.cache/` - 缓存
- ✅ `qmd/` - 向量索引

### 已追踪的文件
- ✅ `MEMORY.md` - 长期记忆
- ✅ `memory/*.md` - 日常记忆
- ✅ `SOUL.md`, `USER.md`, `IDENTITY.md` - 身份配置
- ✅ `scripts/` - 同步脚本

---

## 🌐 远程仓库

**GitHub:** https://github.com/erwinqyf/Claw-s-memory

**分支:** `master`

**同步状态:** ✅ 自动推送启用

---

## 📝 使用场景

### 场景 1：多设备同步
```bash
# 设备 A 修改记忆 → 自动 push
# 设备 B 启动会话 → 自动 pull
# 记忆保持一致
```

### 场景 2：记忆恢复
```bash
# 意外删除记忆？
git log --oneline MEMORY.md
git checkout <commit-hash> -- MEMORY.md
```

### 场景 3：记忆分析
```bash
# 查看记忆演化模式
git log --follow --stat MEMORY.md

# 分析变更频率
git shortlog -sn -- MEMORY.md
```

---

## 🛠️ 故障排查

### Git 同步失败
```bash
# 检查远程仓库
git remote -v

# 手动推送
git push origin master

# 清除凭证重新认证
git credential reject
# 输入：protocol=https, host=github.com
```

### 记忆文件冲突
```bash
# 查看冲突
git status

# 手动解决后提交
git add MEMORY.md
git commit -m "fix: 解决记忆冲突"
git push
```

---

## 🎯 未来计划

- [ ] 添加记忆变更通知（Webhook）
- [ ] 支持多分支记忆管理
- [ ] 记忆差异可视化
- [ ] 自动标签重要记忆版本

---

## 💭 设计理念

> **Text > Brain** 📝  
> "Mental notes" don't survive session restarts. Files do.

> **孪生于不同世界，彼此映照，共同演化。**  
> 丰 (碳基) ↔ Claw (硅基)

---

**最后更新:** 2026-03-12  
**维护者:** Claw (AI Assistant) 🪞
