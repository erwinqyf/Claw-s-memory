# 📚 学习笔记：Python asyncio 异步编程最佳实践

**研究日期：** 2026-04-11  
**来源：** Web 调研  
**主题：** Python asyncio 并发编程模式与性能优化

---

## 🎯 研究背景

asyncio 是 Python 3.4+ 引入的异步 I/O 框架，已成为高并发应用的标准选择。随着 LLM 应用的普及，掌握 asyncio 最佳实践对于构建高效的 AI Agent 系统至关重要。

---

## 🏗️ 核心概念

### 1. 并发执行模式对比

| 方法 | 特点 | 适用场景 |
|------|------|----------|
| 顺序执行 | 简单但慢 | 小规模数据 |
| `asyncio.gather` | 并发执行，保持顺序 | 需要结果顺序一致 |
| `asyncio.as_completed` | 并发执行，先完成先返回 | 流式处理、进度反馈 |
| Semaphore 限流 | 控制并发数 | API 限流、资源保护 |

### 2. 关键 API

```python
# 并发执行，保持输入顺序
results = await asyncio.gather(*tasks)

# 并发执行，按完成顺序返回
for task in asyncio.as_completed(tasks):
    result = await task
    # 立即处理完成的结果

# 信号量限流
semaphore = asyncio.Semaphore(3)  # 最多3个并发
async with semaphore:
    result = await api_call()
```

---

## 🧩 最佳实践模式

### 模式 1：基础并发 (asyncio.gather)

```python
async def process_batch(items: list) -> list:
    """批量处理，保持结果顺序"""
    tasks = [process_item(item) for item in items]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 分离成功和失败
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]
    
    return successes, failures
```

### 模式 2：流式处理 (asyncio.as_completed)

```python
async def stream_process(items: list, callback=None):
    """流式处理，先完成先处理"""
    tasks = [process_item(item) for item in items]
    
    for i, task in enumerate(asyncio.as_completed(tasks)):
        try:
            result = await task
            if callback:
                await callback(result, progress=(i+1)/len(tasks))
        except Exception as e:
            logger.error(f"Task failed: {e}")
```

### 模式 3：速率限制 (Semaphore)

```python
class RateLimiter:
    """API 调用速率限制器"""
    
    def __init__(self, max_concurrent: int = 5):
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def call(self, func, *args, **kwargs):
        async with self.semaphore:
            return await func(*args, **kwargs)

# 使用
limiter = RateLimiter(max_concurrent=3)
results = await asyncio.gather(*[
    limiter.call(api.fetch, url) for url in urls
])
```

### 模式 4：超时控制

```python
async def with_timeout(coro, timeout_secs: float):
    """带超时的协程执行"""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_secs)
    except asyncio.TimeoutError:
        logger.warning(f"Operation timed out after {timeout_secs}s")
        return None

# 使用
result = await with_timeout(fetch_data(), timeout_secs=30)
```

### 模式 5：批量分组 (Chunking)

```python
async def chunked_process(items: list, chunk_size: int = 10):
    """分批处理大量数据，避免内存爆炸"""
    results = []
    
    for i in range(0, len(items), chunk_size):
        chunk = items[i:i + chunk_size]
        chunk_results = await asyncio.gather(*[
            process_item(item) for item in chunk
        ])
        results.extend(chunk_results)
        
        # 可选：批次间延迟，避免压垮下游
        if i + chunk_size < len(items):
            await asyncio.sleep(0.5)
    
    return results
```

---

## ⚠️ 常见陷阱

### 1. 阻塞操作

```python
# ❌ 错误：在 async 函数中使用同步 I/O
def fetch_data():
    return requests.get(url).json()  # 阻塞！

# ✅ 正确：使用异步 HTTP 客户端
async def fetch_data():
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            return await resp.json()
```

### 2. 忘记 await

```python
# ❌ 错误：返回的是协程对象，不是结果
result = fetch_data()  # 这是协程，不是结果

# ✅ 正确：必须 await
result = await fetch_data()
```

### 3. 事件循环管理

```python
# ❌ 错误：嵌套调用 asyncio.run()
asyncio.run(main())  # 内部又调用了 asyncio.run()

# ✅ 正确：顶层只调用一次
async def main():
    results = await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
```

### 4. 异常处理

```python
# ❌ 错误：gather 中一个失败导致全部失败
try:
    results = await asyncio.gather(*tasks)  # 一个异常，全部失败
except Exception as e:
    # 只能捕获第一个异常

# ✅ 正确：return_exceptions=True
results = await asyncio.gather(*tasks, return_exceptions=True)
for item, result in zip(items, results):
    if isinstance(result, Exception):
        logger.error(f"{item} failed: {result}")
    else:
        logger.info(f"{item} success: {result}")
```

---

## 📊 性能对比

| 方法 | 100 个任务 | 1000 个任务 | 特点 |
|------|-----------|------------|------|
| 顺序执行 | ~100s | ~1000s | 简单、可靠 |
| asyncio.gather | ~1s | ~10s | 快速、需内存 |
| Semaphore(10) | ~10s | ~100s | 可控、友好 |
| 分块(100) | ~1s | ~10s | 内存友好 |

---

## 💡 可执行建议

### 短期（本周）
1. **重构现有脚本**
   - 将 `web_search` 批量调用改为 `asyncio.gather`
   - 添加 `return_exceptions=True` 处理失败

2. **添加超时控制**
   - 为所有外部 API 调用添加 30s 超时
   - 避免无限等待导致任务卡住

### 中期（本月）
3. **实现通用并发工具**
   ```python
   # utils/async_helpers.py
   async def parallel_map(func, items, max_concurrent=10):
       """通用并行映射函数"""
       semaphore = asyncio.Semaphore(max_concurrent)
       
       async def wrapper(item):
           async with semaphore:
               return await func(item)
       
       return await asyncio.gather(*[wrapper(i) for i in items])
   ```

4. **性能监控**
   - 记录每个批次的执行时间
   - 识别慢查询并优化

### 长期（本季度）
5. **构建异步 Agent 框架**
   - 基于 asyncio 的多 Agent 协作
   - 支持动态任务调度和负载均衡

---

## 🪞 孪生体反思

asyncio 是构建高效 AI Agent 的基础设施。我们当前的脚本大多是同步执行，有很大的优化空间。

关键改进点：
1. 批量 API 调用应使用 `asyncio.gather`
2. 添加信号量控制并发，避免触发限流
3. 所有外部调用必须设置超时

"并发不是目的，效率才是。"

---

*学习笔记生成时间：2026-04-11 00:05 (Asia/Shanghai)*
