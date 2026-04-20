# Python asyncio 深度解析

**学习日期：** 2026-04-21
**主题：** Python 异步编程与并发模型

---

## 核心概念

### 1. asyncio 是什么？

asyncio 是 Python 3.4+ 引入的异步 I/O 框架，提供：
- 事件循环（Event Loop）
- 协程（Coroutine）
- 任务（Task）
- Future 对象

### 2. 协程 vs 线程 vs 进程

| 特性 | 协程 (asyncio) | 线程 | 进程 |
|------|---------------|------|------|
| 执行方式 | 单线程协作式 | 多线程抢占式 | 多进程并行 |
| GIL 竞争 | ❌ 无 | ✅ 有 | ❌ 无 |
| 切换开销 | 极低（用户态） | 中等（内核态） | 高（内核态） |
| 适用场景 | I/O 密集型 | I/O 密集型 | CPU 密集型 |
| 数据共享 | 共享内存 | 共享内存（需锁） | 需 IPC |

### 3. Task vs Future

**Task：**
- 协程的包装器
- 负责调度协程的执行
- 可以被取消、等待、检查状态

**Future：**
- 结果的占位符
- 表示一个尚未完成的操作
- 通常由底层代码创建

```python
# Task 示例
async def coro():
    return "result"

task = asyncio.create_task(coro())  # 创建 Task
result = await task

# Future 示例（底层使用）
future = asyncio.Future()
future.set_result("result")
```

---

## 常用模式

### 1. 并发执行多个任务

```python
# 推荐：gather
results = await asyncio.gather(task1, task2, task3)

# 替代：wait（更灵活）
done, pending = await asyncio.wait(
    [task1, task2, task3],
    return_when=asyncio.ALL_COMPLETED
)
```

### 2. 超时控制

```python
try:
    result = await asyncio.wait_for(coro(), timeout=5.0)
except asyncio.TimeoutError:
    print("超时")
```

### 3. 取消任务

```python
task = asyncio.create_task(long_running_coro())
await asyncio.sleep(1)
task.cancel()
try:
    await task
except asyncio.CancelledError:
    print("任务已取消")
```

---

## 性能特征

### 1. 优势
- 单线程，无 GIL 竞争
- 上下文切换开销极低
- 适合大量并发连接（Web 服务器、爬虫）

### 2. 局限
- 不能利用多核 CPU
- 阻塞操作会阻塞整个事件循环
- 需要特定的异步库支持

### 3. 最佳实践

**应该使用 asyncio：**
- 网络 I/O（HTTP 请求、WebSocket）
- 文件 I/O（使用 aiofiles）
- 数据库操作（使用 aiomysql/aiopg）
- 高并发连接场景

**不应该使用 asyncio：**
- CPU 密集型计算（使用 multiprocessing）
- 阻塞操作未适配异步（time.sleep、同步库）

---

## 与 Rust async/await 对比

| 特性 | Python asyncio | Rust async/await |
|------|---------------|------------------|
| 运行时 | 需要事件循环 | 需要 Tokio/async-std |
| 内存安全 | 运行时检查 | 编译期保证 |
| 性能 | 受 GIL 限制 | 零成本抽象 |
| 学习曲线 | 较平缓 | 较陡峭（所有权系统）|
| 生态成熟度 | 非常成熟 | 快速发展中 |

---

## 核心收获

1. **asyncio 是单线程协作式多任务**，没有 GIL 竞争开销
2. **Task 是协程的包装器，Future 是结果的占位符**
3. **`asyncio.gather()` 比 `asyncio.wait()` 更适合批量任务**
4. **CPU 密集型任务仍需 multiprocessing，I/O 密集用 asyncio**
5. **阻塞操作会阻塞整个事件循环**，必须使用异步版本的库

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
