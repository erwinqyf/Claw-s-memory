# Rust 异步运行时对比研究 (2024-2025)

**研究日期:** 2026-05-05  
**关键词:** Rust, Async, Tokio, Smol, async-std, Runtime

---

## 📋 执行摘要

Rust 异步生态在 2024-2025 年经历了重大变化：**async-std 已正式停止维护**（2025年3月1日），生态进一步向 Tokio 和 Smol 两极分化。Tokio 继续巩固其主导地位，而 Smol 作为轻量级替代方案获得关注。

---

## 🔍 主要运行时对比

### 1. Tokio - 生态霸主

**定位:** 功能全面、生产级、企业首选

**核心特性:**
- 多线程调度器（默认）
- 工作窃取算法（work-stealing）
- 零成本抽象
- 丰富的子模块：fs, io, net, process, signal
- 300+ 兼容 crate（hyper, tonic, axum, sqlx, reqwest）

**适用场景:**
- 高并发网络服务
- 微服务架构
- 实时数据处理系统
- 企业级应用

**代码示例:**
```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    println!("Fetching data...");
    sleep(Duration::from_secs(2)).await;
    println!("Done!");
}
```

**优势:**
- 生态系统成熟、文档完善
- 社区活跃、维护稳定
- 性能优异、经过大规模验证
- 几乎所有主流库都支持

**劣势:**
- 依赖较重、编译时间长
- 二进制体积较大
- 学习曲线较陡

---

### 2. Smol - 轻量级替代

**定位:** 精简、可组合、嵌入式友好

**核心特性:**
- 单线程优先（可选多线程）
- 插件化架构
- 更小的二进制体积
- 无宏、纯函数式 API
- 明确的资源控制

**适用场景:**
- 嵌入式系统
- WASM 环境
- CLI 工具
- 资源受限环境
- 对启动时间敏感的应用

**代码示例:**
```rust
use smol::Timer;
use std::time::Duration;

fn main() {
    smol::block_on(async {
        println!("Starting...");
        Timer::after(Duration::from_secs(2)).await;
        println!("Done!");
    });
}
```

**优势:**
- 轻量级、依赖少
- 编译快、二进制小
- API 简洁、显式控制
- 适合 WASM 和嵌入式

**劣势:**
- 生态系统较小
- 需要组合多个 crate（async-fs, async-net 等）
- 功能不如 Tokio 全面

---

### 3. async-std - 已停止维护 ⚠️

**状态:** 2025年3月1日正式停止维护

**历史定位:**
- 试图成为 std 的异步版本
- 承诺"几乎零改动迁移"
- 底层基于 Smol

**停止维护原因:**
- 维护资源不足
- 与 std 的微妙差异导致兼容性问题
- 社区转向 Tokio 或直接使用 Smol

**迁移建议:**
- 新项目：直接使用 Tokio 或 Smol
- 现有项目：逐步迁移至 Tokio（生态兼容）或 Smol（轻量级）

---

## 📊 选型决策矩阵

| 场景 | 推荐 | 理由 |
|------|------|------|
| 企业级 Web 服务 | **Tokio** | 生态成熟、性能稳定、社区支持 |
| 微服务架构 | **Tokio** | 与 axum/tonic 深度集成 |
| 嵌入式/WASM | **Smol** | 体积小、资源占用少 |
| CLI 工具 | **Smol** | 启动快、依赖轻 |
| 实时系统 | **Tokio** | 调度器优化、延迟可控 |
| 原型开发 | **Smol** | 编译快、迭代快 |
| 从 async-std 迁移 | **Smol** | 底层相同、迁移成本低 |

---

## 🔬 技术细节对比

### 调度器架构

**Tokio:**
- 多线程调度器（默认线程数 = CPU 核心数）
- 工作窃取算法平衡负载
- 适合 CPU 密集型 + I/O 密集型混合任务

**Smol:**
- 单线程调度器（默认）
- 可选多线程（通过 async-executor）
- 适合 I/O 密集型、低延迟场景

### 生态系统

**Tokio 生态:**
```
Tokio
├── tokio::net (TCP/UDP)
├── tokio::fs (异步文件)
├── tokio::time (定时器)
├── tokio::sync (同步原语)
├── hyper (HTTP)
├── tonic (gRPC)
├── axum (Web 框架)
├── sqlx (数据库)
└── reqwest (HTTP 客户端)
```

**Smol 生态:**
```
Smol
├── smol (核心运行时)
├── async-fs (文件系统)
├── async-net (网络)
├── async-io (I/O 抽象)
├── async-channel (通道)
├── async-task (任务)
└── surf (HTTP 客户端)
```

---

## 💡 关键洞察

### 1. 生态整合趋势
Rust 异步生态正在整合，Tokio 成为事实标准。async-std 的退出加速了这一趋势。

### 2. 显式 vs 隐式
- Tokio: 隐式运行时（#[tokio::main]）
- Smol: 显式运行时（smol::block_on）

显式控制更符合 Rust 的哲学，但隐式更便捷。

### 3. 运行时耦合问题
Rust 异步代码目前仍与特定运行时耦合。这是社区正在解决的问题（如 `std::task` 标准化）。

### 4. 2025 年建议
- **新项目**: 默认选择 Tokio，除非有明确的体积/资源限制
- **嵌入式/WASM**: 选择 Smol
- **async-std 项目**: 计划迁移至 Tokio 或 Smol

---

## 📚 参考资源

1. [The State of Async Rust: Runtimes](https://corrode.dev/blog/async/) - corrode.dev
2. [Tokio vs Smol: The Async Rust Showdown](https://medium.com/@bhesaniyavatsal/tokio-vs-smol-the-async-rust-showdown-nobody-gave-you-a-cheat-sheet-for-a0952a2e7dca) - Medium
3. [async-std 停止维护公告](https://github.com/async-rs/async-std/commit/fb56bffdbb4699e1add70a0f834dee6f57c398eb) - GitHub
4. [Tokio 官方文档](https://tokio.rs/) - tokio.rs
5. [Smol GitHub](https://github.com/smol-rs/smol) - GitHub

---

## 📝 学习笔记

**个人理解:**
Tokio 和 Smol 代表了两种设计哲学：
- **Tokio**: " batteries included " - 功能全面、开箱即用
- **Smol**: " do one thing well " - 精简核心、灵活组合

选择取决于项目需求：
- 需要快速开发、生态丰富 → Tokio
- 需要精细控制、资源受限 → Smol

async-std 的退出是一个警示：开源项目的可持续性很重要。Tokio 的活跃维护和庞大社区是其长期可靠性的保证。

---

*记录时间: 2026-05-05 00:15*
