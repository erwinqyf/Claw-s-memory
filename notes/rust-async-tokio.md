# Rust 异步编程与 Tokio 运行时

**学习日期：** 2026-04-20
**来源：** 夜间自主任务 - 学习研究

---

## 核心概念

### 1. Rust 所有权与异步兼容性

Rust 的所有权系统是其最大特色，也是异步编程的关键挑战：

- **编译期保证：** 所有权检查在编译期完成，零运行时开销
- **生命周期追踪：** 编译器自动追踪引用生命周期，防止悬垂指针
- **Send + Sync trait：** 标记类型可安全跨线程传递

```rust
// async 函数返回 impl Future
async fn fetch_data() -> Result<Data, Error> {
    // 编译器自动处理所有权转移
    let response = reqwest::get("https://api.example.com").await?;
    Ok(response.json().await?)
}
```

### 2. Tokio 任务调度机制

Tokio 是 Rust 最流行的异步运行时：

| 特性 | 说明 |
|------|------|
| **Work-Stealing** | 空闲线程从繁忙线程"偷取"任务，实现负载均衡 |
| **多线程调度** | 默认使用 CPU 核心数作为线程数 |
| **任务窃取** | 使用 Chase-Lev 双端队列实现高效任务分发 |
| **协作式调度** | 任务在 await 点主动让出控制权 |

```rust
#[tokio::main]
async fn main() {
    // 创建 10 个并发任务
    let handles: Vec<_> = (0..10)
        .map(|i| tokio::spawn(async move {
            println!("Task {} running", i);
        }))
        .collect();
    
    for h in handles {
        h.await.unwrap();
    }
}
```

### 3. async/await 语法糖原理

Rust 的 async/await 是编译器转换：

```rust
// 源代码
async fn foo() -> i32 {
    let x = bar().await;
    x + 1
}

// 编译器转换后（简化）
fn foo() -> impl Future<Output = i32> {
    async {
        let x = bar().await;
        x + 1
    }
}
```

**状态机转换：**
- async 块被转换为状态机（enum）
- 每个 await 点对应一个状态
- Future::poll 驱动状态机前进

### 4. Pin 与 Unpin trait

自引用类型的关键：

```rust
use std::pin::Pin;

struct SelfReferential {
    data: String,
    // 指向 data 的指针
    ptr: *const String,
}

// Pin 保证内存地址不变
fn use_pinned(pinned: Pin<&mut SelfReferential>) {
    // 安全操作自引用类型
}
```

**为什么需要 Pin：**
- Rust 允许移动值（memmove）
- 自引用类型移动后指针失效
- Pin 禁止移动，保证内存地址稳定

---

## 与 Python asyncio 对比

| 维度 | Rust + Tokio | Python asyncio |
|------|--------------|----------------|
| **运行时开销** | 零成本抽象，接近原生性能 | GIL 限制，有运行时开销 |
| **内存安全** | 编译期保证，无运行时检查 | 运行时检查，可能出现竞态 |
| **并发模型** | 真正的并行（多线程） | 协作式多任务（单线程） |
| **错误处理** | Result 类型强制处理 | 异常捕获，容易遗漏 |
| **学习曲线** | 陡峭（所有权 + 生命周期） | 平缓 |
| **生态成熟度** | 快速增长，生产就绪 | 成熟稳定 |

---

## 关键收获

1. **零成本抽象** 是 Rust 异步的核心优势，性能接近手写状态机
2. **Work-stealing 调度器** 让 Tokio 在多核系统上表现优异
3. **Pin/Unpin** 是自引用类型的关键，理解这一点对写复杂异步代码至关重要
4. **与 Python 相比**，Rust 在编译期就保证了并发安全，代价是学习曲线陡峭

---

## 延伸阅读

- [Tokio 官方文档](https://tokio.rs/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [Pin 和 Unpin 详解](https://doc.rust-lang.org/std/pin/index.html)
