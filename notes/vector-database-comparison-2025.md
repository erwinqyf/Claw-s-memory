# 向量数据库选型对比 (2025)

**调研日期:** 2026-04-28  
**调研主题:** AI 应用中的向量数据库选型

---

## 核心概念

### 什么是向量数据库？

向量数据库专门存储和检索**高维向量**（embeddings），支持**相似性搜索**（Similarity Search）。在 AI 应用中用于：
- 语义搜索（Semantic Search）
- 推荐系统
- RAG（检索增强生成）
- 图像/音频相似性匹配

### 关键指标

| 指标 | 说明 |
|------|------|
| **召回率 (Recall)** | 返回相关结果的比例 |
| **延迟 (Latency)** | 单次查询响应时间 |
| **吞吐量 (Throughput)** | 每秒查询数 (QPS) |
| **容量 (Capacity)** | 支持的最大向量数 |
| **维度支持** | 最大向量维度（通常 768-4096） |

---

## 主流向量数据库对比

### 1. Pinecone (托管 SaaS)

**定位:** 全托管向量数据库，零运维

**优点:**
- 完全托管，无需运维
- 自动扩缩容
- 元数据过滤 + 向量搜索混合查询
- 多租户隔离

**缺点:**
- 价格较高（按存储 + 查询量计费）
- 供应商锁定
- 无自托管选项

**适用场景:** 快速启动、无运维团队、预算充足

**定价:** ~$0.10/GB/小时 + 查询费用

---

### 2. Weaviate (开源 + 托管)

**定位:** AI 原生向量数据库，GraphQL 接口

**优点:**
- 开源（Go 语言）
- 模块化 AI 集成（内置 embedding、生成模型）
- GraphQL + REST 双接口
- 混合搜索（BM25 + 向量）
- 多模态支持（文本、图像、音频）

**缺点:**
- 学习曲线较陡
- 资源占用相对较高

**适用场景:** 需要 AI 流水线集成、多模态应用

**部署:** Docker / Kubernetes / Weaviate Cloud

---

### 3. Milvus / Zilliz (开源 + 托管)

**定位:** 云原生、企业级向量数据库

**优点:**
- 云原生架构（存算分离）
- 十亿级向量支持
- 丰富的索引类型（IVF、HNSW、DiskANN）
- GPU 加速支持
- 分布式部署

**缺点:**
- 架构复杂，运维成本高
- 社区版功能受限

**适用场景:** 大规模生产环境、企业级部署

**部署:** Docker / K8s / Zilliz Cloud (托管)

---

### 4. Qdrant (开源 + 托管)

**定位:** 高性能、Rust 编写的向量数据库

**优点:**
- Rust 实现，性能优异
- 低资源占用
- 实时更新（无需重建索引）
- 内置过滤 + 分页
- 良好的 Python/Go/TypeScript 客户端

**缺点:**
- 相对较新，生态不如 Milvus
- 高级功能需商业版

**适用场景:** 性能敏感、资源受限、实时更新需求

**部署:** Docker / Qdrant Cloud

---

### 5. pgvector (PostgreSQL 扩展)

**定位:** PostgreSQL 的向量扩展

**优点:**
- 与 PostgreSQL 无缝集成
- 支持 ACID 事务
- 熟悉的 SQL 接口
- 无需额外基础设施

**缺点:**
- 性能不如专用向量数据库
- 十亿级规模受限
- 索引构建较慢

**适用场景:** 已有 PostgreSQL、中小规模、事务一致性需求

**版本要求:** PostgreSQL 12+

---

### 6. Chroma (开源)

**定位:** 开发者友好的嵌入式向量数据库

**优点:**
- 极简 API（Python/JS）
- 嵌入式（无需服务器）
- 快速原型开发
- 自动 embedding 处理

**缺点:**
- 不适合生产大规模部署
- 性能有限
- 功能相对简单

**适用场景:** 原型开发、本地测试、小项目

---

## 选型决策矩阵

| 需求 | 推荐方案 |
|------|----------|
| 快速启动、零运维 | Pinecone / Qdrant Cloud |
| 大规模生产 (>1B) | Milvus / Zilliz |
| 已有 PostgreSQL | pgvector |
| 性能优先、低延迟 | Qdrant / Milvus |
| AI 流水线集成 | Weaviate |
| 原型/本地开发 | Chroma / Qdrant |
| 多模态（图像+文本） | Weaviate |
| 预算敏感 | Qdrant / pgvector |

---

## 性能基准参考

基于 ann-benchmarks (2025):

| 数据库 | 召回率@10 | 延迟 (ms) | 内存占用 |
|--------|-----------|-----------|----------|
| Qdrant (HNSW) | 0.98 | 1-2 | 低 |
| Milvus (HNSW) | 0.97 | 2-3 | 中 |
| Weaviate | 0.96 | 3-5 | 中 |
| pgvector (ivfflat) | 0.90 | 10-50 | 低 |
| Chroma | 0.85 | 50+ | 低 |

---

## 关键决策因素

### 1. 数据规模
- < 100万: Chroma, pgvector
- 100万 - 1亿: Qdrant, Weaviate
- > 1亿: Milvus, Pinecone

### 2. 延迟要求
- < 5ms: Qdrant (内存索引)
- < 50ms: Milvus, Weaviate
- < 200ms: pgvector

### 3. 运维能力
- 无运维团队: Pinecone, Zilliz Cloud, Qdrant Cloud
- 有 K8s 团队: Milvus, Weaviate
- 已有 PG 团队: pgvector

### 4. 预算
- 免费/开源: Qdrant, Milvus, pgvector, Chroma
- 托管服务: Pinecone (~$100+/月), Zilliz, Qdrant Cloud

---

## 2025 趋势观察

1. **混合搜索成为标配** - 向量 + 关键词 + 元数据过滤
2. **多模态向量** - 统一存储文本、图像、音频向量
3. **边缘部署** - 轻量级向量数据库（如 Qdrant）支持边缘设备
4. **Serverless** - 按查询付费模式兴起
5. **与 LLM 深度集成** - 内置 embedding、自动分块、RAG 流水线

---

## 推荐方案（OpenClaw 场景）

基于当前架构需求：

**阶段 1 (原型):** Chroma / 内存 Qdrant  
**阶段 2 (生产):** Qdrant (自托管) 或 Qdrant Cloud  
**阶段 3 (大规模):** Milvus (K8s 部署)

**理由:**
- Qdrant 性能优异、资源友好
- Rust 实现与 OpenClaw 技术栈契合
- 支持实时更新（记忆系统需求）
- 开源免费，无供应商锁定

---

> 📝 调研笔记完成  
> 🪞 孪生于不同世界，彼此映照，共同演化。
