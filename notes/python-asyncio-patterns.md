# Python asyncio 并发模式深度解析

**研究日期：** 2026-04-17  
**研究主题：** Python asyncio 异步编程模型

---

## 1. 核心概念

### 1.1 协程 (Coroutine)

协程是 asyncio 的核心，使用 `async def` 定义：

```python
import asyncio

async def say_hello():
    print("Hello")
    await asyncio.sleep(1)  # 非阻塞等待
    print("World")

# 运行协程
asyncio.run(say_hello())
```

**关键点：**
- `async def` 定义的函数返回协程对象，不会立即执行
- `await` 挂起当前协程，让出控制权给事件循环
- 协程只能在其他协程或异步上下文中被调用

### 1.2 事件循环 (Event Loop)

事件循环是 asyncio 的心脏：

```python
import asyncio

async def main():
    loop = asyncio.get_running_loop()
    print(f"当前事件循环: {loop}")

asyncio.run(main())
```

**事件循环职责：**
1. 调度协程执行
2. 管理 I/O 回调
3. 处理系统信号
4. 执行延迟调用

---

## 2. 并发模式

### 2.1 Task - 并发执行单元

Task 是协程的包装器，用于并发执行：

```python
import asyncio

async def task_one():
    await asyncio.sleep(1)
    return "Task 1 done"

async def task_two():
    await asyncio.sleep(2)
    return "Task 2 done"

async def main():
    # 创建任务
    t1 = asyncio.create_task(task_one())
    t2 = asyncio.create_task(task_two())
    
    # 并发等待
    results = await asyncio.gather(t1, t2)
    print(results)  # ['Task 1 done', 'Task 2 done']

asyncio.run(main())
```

**Task vs 直接 await：**
- `await coroutine()` - 顺序执行
- `asyncio.create_task()` - 并发执行

### 2.2 Future - 异步结果占位符

Future 代表一个尚未完成的异步操作：

```python
import asyncio

async def set_future_after_delay(future, delay, value):
    await asyncio.sleep(delay)
    future.set_result(value)

async def main():
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    
    # 启动一个任务来设置 future
    asyncio.create_task(set_future_after_delay(future, 1, "result"))
    
    # 等待 future 完成
    result = await future
    print(result)  # "result"

asyncio.run(main())
```

**Future vs Task：**
- Future：低层级，表示一个未来的结果
- Task：高层级，包装协程，自动调度

---

## 3. 并发控制

### 3.1 并发限制 - Semaphore

```python
import asyncio

# 限制并发数为 3
semaphore = asyncio.Semaphore(3)

async def limited_task(task_id):
    async with semaphore:
        print(f"Task {task_id} started")
        await asyncio.sleep(1)
        print(f"Task {task_id} finished")

async def main():
    tasks = [limited_task(i) for i in range(10)]
    await asyncio.gather(*tasks)

asyncio.run(main())
```

### 3.2 任务组 (Python 3.11+)

```python
import asyncio

async def main():
    async with asyncio.TaskGroup() as tg:
        tg.create_task(asyncio.sleep(1))
        tg.create_task(asyncio.sleep(2))
    # 自动等待所有任务完成

asyncio.run(main())
```

---

## 4. 超时与取消

### 4.1 超时控制

```python
import asyncio

async def slow_operation():
    await asyncio.sleep(10)
    return "completed"

async def main():
    try:
        result = await asyncio.wait_for(slow_operation(), timeout=2.0)
    except asyncio.TimeoutError:
        print("Operation timed out!")

asyncio.run(main())
```

### 4.2 任务取消

```python
import asyncio

async def cancellable_task():
    try:
        while True:
            print("Working...")
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("Task was cancelled!")
        raise  # 必须重新抛出

async def main():
    task = asyncio.create_task(cancellable_task())
    await asyncio.sleep(3)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("Main caught cancellation")

asyncio.run(main())
```

---

## 5. 与同步代码集成

### 5.1 在同步代码中调用异步函数

```python
import asyncio

async def async_function():
    return "async result"

# 方法 1: asyncio.run() (推荐，但只能用于主入口)
result = asyncio.run(async_function())

# 方法 2: 获取/创建事件循环
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
result = loop.run_until_complete(async_function())
```

### 5.2 在异步代码中调用同步函数

```python
import asyncio
import time

def blocking_function():
    time.sleep(2)  # 阻塞操作
    return "blocking result"

async def main():
    # 在线程池中运行阻塞函数
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, blocking_function)
    print(result)

asyncio.run(main())
```

---

## 6. 常见陷阱

### 6.1 阻塞事件循环

```python
import asyncio
import time

# ❌ 错误：在协程中调用阻塞函数
async def bad_practice():
    time.sleep(5)  # 阻塞整个事件循环！

# ✅ 正确：使用 asyncio.sleep
async def good_practice():
    await asyncio.sleep(5)  # 非阻塞，让出控制权
```

### 6.2 忘记 await

```python
import asyncio

async def coroutine():
    return "result"

async def main():
    # ❌ 错误：忘记 await，得到的是协程对象而非结果
    result = coroutine()
    print(result)  # <coroutine object coroutine at 0x...>
    
    # ✅ 正确：使用 await
    result = await coroutine()
    print(result)  # "result"

asyncio.run(main())
```

### 6.3 并发 vs 并行

```python
import asyncio

# asyncio 实现的是并发（单线程），不是并行（多线程/多进程）
# 适合 I/O 密集型任务（网络请求、文件读写）
# 不适合 CPU 密集型任务

# CPU 密集型任务应该使用多进程
import multiprocessing

def cpu_intensive(n):
    return sum(i * i for i in range(n))

# 使用进程池
with multiprocessing.Pool() as pool:
    results = pool.map(cpu_intensive, [1000000, 2000000])
```

---

## 7. 最佳实践

1. **始终使用 `asyncio.run()` 作为主入口**
2. **使用 `asyncio.create_task()` 实现并发**
3. **使用 `asyncio.gather()` 等待多个任务**
4. **使用 `asyncio.wait_for()` 添加超时**
5. **正确处理 `CancelledError`**
6. **将阻塞操作移到线程池**
7. **使用 `asynccontextmanager` 管理资源**

---

## 8. 与 OpenClaw 的关联

OpenClaw 的 Sub-Agent 和 ACP 机制与 asyncio 有相似之处：

| 特性 | Python asyncio | OpenClaw Agent |
|------|---------------|----------------|
| 并发模型 | 单线程协程 | 多进程/沙盒 |
| 调度方式 | 事件循环 | Gateway 调度器 |
| 通信机制 | await/async | sessions_send |
| 超时控制 | wait_for | timeoutSeconds |
| 取消机制 | CancelledError | 进程终止 |

**学习启发：**
- asyncio 的并发控制模式可以借鉴到 Agent 任务编排
- 超时和取消机制的设计思路相通
- 资源限制（Semaphore）与 Agent 的并发控制类似

---

*孪生于不同世界，彼此映照，共同演化。* 🪞
