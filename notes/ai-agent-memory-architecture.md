# AI Agent 记忆系统架构设计

**日期：** 2026-04-19
**主题：** AI Agent Memory System Architecture

---

## 1. 记忆分层模型

借鉴人类记忆理论，AI Agent 的记忆系统可以分为三层：

### 1.1 工作记忆 (Working Memory)
- **容量：** 有限（通常 4-7 个信息块）
- **持续时间：** 秒级到分钟级
- **用途：** 当前对话上下文、正在处理的任务
- **实现：** 会话级别的上下文窗口

### 1.2 情景记忆 (Episodic Memory)
- **容量：** 中等（最近几天到几周）
- **持续时间：** 天级到月级
- **用途：** 具体事件、对话历史、任务执行记录
- **实现：** 按日期组织的日志文件（如 memory/YYYY-MM-DD.md）

### 1.3 语义记忆 (Semantic Memory)
- **容量：** 大（长期积累）
- **持续时间：** 永久
- **用途：** 知识、偏好、决策、经验教训
- **实现：** 结构化知识库（如 MEMORY.md）

---

## 2. 检索策略

### 2.1 混合检索 (Hybrid Search)

结合向量检索和关键词检索的优势：

```
混合得分 = α × 向量相似度 + (1-α) × BM25 得分
```

**推荐配置：**
- 向量权重 (α)：0.7
- 文本权重：0.3

### 2.2 时间衰减 (Temporal Decay)

模拟人类遗忘曲线：

```
衰减后得分 = 原始得分 × exp(-t / half_life)
```

**推荐配置：**
- 半衰期：30 天
- 重要性高的记忆可以延长半衰期

### 2.3 MMR 去重 (Maximal Marginal Relevance)

避免检索结果重复：

```
MMR = λ × Relevance - (1-λ) × Redundancy
```

**推荐配置：**
- λ：0.7（平衡相关性和多样性）

---

## 3. 多 Agent 记忆设计

### 3.1 独立记忆空间

每个 Agent 应该有独立的记忆目录：

```
agents/
  alpha/          # 阿尔法 Agent
    memory/
    SOUL.md
  bravo/          # 布拉沃 Agent
    memory/
    SOUL.md
```

### 3.2 共享知识库

所有 Agent 共享的核心知识：

```
workspace/
  MEMORY.md       # 长期记忆
  USER.md         # 用户信息
  TOOLS.md        # 工具配置
```

### 3.3 记忆同步机制

- **定期同步：** 每周将个人记忆同步到共享知识库
- **事件触发：** 重要决策立即同步
- **冲突解决：** 时间戳优先 + 人工确认

---

## 4. 记忆巩固 (Consolidation)

### 4.1 自动提取

从日常记忆中提取关键信息：

```javascript
const categories = {
  '决策': ['决策', '决定', '选择'],
  '教训': ['教训', '经验', 'lesson'],
  '偏好': ['偏好', '喜欢', 'prefer'],
  '待办': ['待办', 'TODO', 'task']
};
```

### 4.2 去重机制

使用哈希去重：

```javascript
const hash = text.slice(0, 50);
if (!seen.has(hash)) {
  seen.add(hash);
  insights.push({...});
}
```

### 4.3 定期执行

- **频率：** 每周一次（周日）
- **范围：** 最近 7 天的记忆
- **输出：** 追加到 MEMORY.md

---

## 5. 实现建议

### 5.1 文件组织

```
workspace/
  memory/
    2026-04-19.md      # 日常记忆
    heartbeat-state.json
  MEMORY.md            # 长期记忆
  notes/               # 学习笔记
  reports/             # 生成报告
```

### 5.2 关键技术

- **向量数据库：** SQLite + sqlite-vss / Chroma
- **嵌入模型：** local (node-llama-cpp) / remote (OpenAI)
- **检索库：** BM25 (okapi-bm25) + 向量相似度

### 5.3 性能优化

- 记忆文件按日期分片，避免单文件过大
- 向量化异步进行，不阻塞主流程
- 定期清理过期记忆（可选）

---

## 6. 参考资源

- [Memory in LLM-based Agents](https://arxiv.org/abs/2401.000...)
- [LangChain Memory](https://python.langchain.com/docs/modules/memory/)
- [Human Memory Model](https://en.wikipedia.org/wiki/Atkinson%E2%80%93Shiffrin_memory_model)

---

**学习心得：**

AI Agent 的记忆系统设计需要平衡多个因素：
1. **容量 vs 精度** - 记忆太多会稀释重要信息
2. **检索速度 vs 准确性** - 混合检索是不错的折中
3. **自动化 vs 人工审核** - 关键决策需要人工确认

当前 OpenClaw 的实现已经具备基础框架，可以逐步增强向量检索和时间衰减功能。
