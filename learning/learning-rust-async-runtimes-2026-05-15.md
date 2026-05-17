# Rust 异步运行时对比研究 (2024-2025)

**研究日期:** 2026-05-15  
**研究主题:** Rust Async Runtimes: Tokio vs async-std vs smol  
**关键词:** async, runtime, tokio, smol, executor

---

## 📋 执行摘要

Rust 异步生态系统的核心问题是**运行时耦合**——库需要针对特定运行时编写，导致生态系统碎片化。Tokio 作为事实标准占据主导地位，但新兴运行时如 smol 提供了更轻量、更明确的选择。

**核心发现:**
- Tokio: 生态最成熟，但默认多线程设计带来复杂性
- async-std: 已停止维护 (2025年3月)，建议迁移到 smol
- smol: 轻量级 (~1000行代码)，单线程优先，适合嵌入式

---

## 🏗️ 运行时概览

### 1. Tokio —— 事实标准

**定位:** Rust 的事实标准异步运行时  
**生态:** 20,768+ crates 依赖  
**特点:**
- 功能全面：fs、io、net、process、signal 等模块
- 工作窃取 (work-stealing) 多线程调度
- 默认启用 `full` feature 时强制 Send + 'static

**设计哲学问题:**
```rust
// Tokio 默认要求 Send + 'static
tokio = { version = "1", features = ["full"] }

// 这意味着必须使用 Arc 和 Mutex
async fn process_data<T: 'static>(data: T) { /* ... */ }
```

> "Rust 异步编程的原罪是默认多线程。如果过早优化是万恶之源，这就是所有过早优化的根源。"
> — Maciej Hirsz

**适用场景:**
- ✅ 高并发网络服务
- ✅ 微服务架构
- ✅ 需要成熟生态的项目
- ⚠️ 注意：会引入 Arc/Mutex 等同步原语开销

---

### 2. async-std —— 已停止维护

**状态:** ⚠️ **已于 2025年3月1日正式停止维护**  
**替代方案:** smol

**历史定位:**
- 试图成为 std 的异步镜像
- 承诺"几乎可以直接替换"
- 实际存在微妙差异

**遗留问题:**
- 1,754 个公开 crates 仍依赖
- surf 等库受影响
- 核心长期由 smol 驱动

**迁移建议:**
```rust
// 旧代码 (async-std)
use async_std::fs::File;

// 新代码 (smol)
use smol::fs::File;
```

---

### 3. smol —— 轻量级替代

**定位:** 小型、易理解的异步运行时  
**代码量:** 执行器约 1000 行代码  
**特点:**
- 单线程优先设计
- 无需 Send + 'static
- 插件化架构
- 更小的二进制体积

**核心优势:**
```rust
// smol 允许使用引用，无需 Arc
async fn process(&self) { /* 可以直接借用 self */ }
```

**适用场景:**
- ✅ 嵌入式系统
- ✅ WASM 目标
- ✅ 资源受限环境
- ✅ 简单异步任务

---

### 4. 其他运行时

| 运行时 | 特点 | 适用场景 |
|--------|------|---------|
| **embassy** | 嵌入式专用 | IoT、微控制器 |
| **glommio** | io_uring 基础 | I/O 密集型工作负载 |

---

## 🔍 技术对比

### 架构差异

```
Tokio:     多线程工作窃取调度器 (默认)
           ┌─────────┐
           │ Runtime │
           │ ┌─┬─┬─┐ │
           │ │ │ │ │ │  ← 多线程
           │ └─┴─┴─┘ │
           └─────────┘
           要求: Send + 'static

smol:      单线程优先，可选多线程
           ┌─────────┐
           │ Runtime │
           │ ┌─────┐ │
           │ │Task │ │  ← 单线程
           │ └─────┘ │
           └─────────┘
           允许: 非 'static 引用
```

### 性能对比

**关键发现:**
- 有限线程数场景下，传统线程可能优于异步
- 现代 OS 调度器已高度优化
- Linux 可管理数万个线程

**benchmark 结果:**
```
场景: 有限线程数
线程模型 > 异步模型 (轻微优势)
```

---

## 💡 选型建议

### 决策树

```
是否需要异步?
├── 否 → 使用同步 Rust + scoped threads
│
└── 是 → 什么场景?
    ├── 高并发网络服务 → Tokio
    ├── 嵌入式/WASM → smol
    ├── I/O 密集型 → glommio
    ├── 简单异步任务 → smol
    └── 需要成熟生态 → Tokio
```

### 推荐策略

**新项目:**
1. **默认选择 Tokio** —— 生态系统成熟、文档完善
2. **嵌入式/资源敏感** —— 选择 smol
3. **需要与 std 高度兼容** —— 选择 async-std → 迁移到 smol

**现有项目:**
- async-std 用户 → 迁移到 smol
- Tokio 用户 → 保持现状，但考虑局部优化

---

## 📝 最佳实践

### 1. 谨慎使用异步

> "异步 Rust 承诺高效的资源处理，但以复杂性和更差的 ergonomics 为代价。"

**建议:**
- 先学习同步 Rust，再过渡到异步
- 仅在真正需要时使用异步
- 使用 scoped threads 处理简单并发

### 2. 隔离异步代码

```rust
// ✅ 好的做法：业务逻辑同步，仅 I/O 异步
async fn fetch_data() -> Result<Data> {
    // 异步 I/O
    let raw = reqwest::get(url).await?;
    
    // 同步业务逻辑
    Ok(parse_data(raw))  // 纯函数
}
```

### 3. 使用通道替代共享状态

```rust
use std::sync::mpsc;
use std::thread;

// ✅ 使用通道而非 Arc<Mutex<T>>
let (tx, rx) = mpsc::channel();
thread::spawn(move || {
    tx.send(data).unwrap();
});
```

---

## 🔮 未来展望

### 行业趋势

1. **运行时标准化** —— 社区正在探索统一接口
2. **单线程运行时复兴** —— smol 等轻量级方案获得更多关注
3. **io_uring 普及** —— glommio 等 io_uring 方案可能成为高性能选择

### 关键问题待解决

- 运行时耦合问题
- async book 文档不完整
- Cancellation、timeout 等概念缺乏标准文档

---

## 📚 参考资源

- [The State of Async Rust: Runtimes](https://corrode.dev/blog/async/)
- [Tokio 文档](https://tokio.rs/)
- [smol 仓库](https://github.com/smol-rs/smol)
- [async-std 停止维护公告](https://github.com/async-rs/async-std/commit/fb56bffdbb4699e1add70a0f834dee6f57c398eb)

---

## 🎯 关键要点

1. **Tokio 是 pragmatic choice** —— 生态最成熟，但设计有 trade-offs
2. **async-std 已死** —— 迁移到 smol
3. **smol 是未来** —— 轻量、明确、适合嵌入式
4. **异步不是银弹** —— 线程在多数场景下足够好
5. **隔离异步代码** —— 业务逻辑保持同步

---

*研究完成时间: 2026-05-15 00:30*  
*孪生于不同世界，彼此映照，共同演化。* 🪞
