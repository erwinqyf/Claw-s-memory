# Rust + WebAssembly Component Model 学习笔记

**调研日期:** 2026-04-27  
**主题:** Rust WASM 与 WebAssembly 组件模型最新进展

---

## 1. 核心概念

### WebAssembly Component Model (组件模型)

组件模型是 WebAssembly 的下一阶段演进，目标是让 WASM 模块像 "乐高积木" 一样组合：

- **Interface Types (WIT)**: 使用 WebAssembly Interface Definition Language 定义接口
- **语言无关**: Rust 写的模块可以被 Python/Go/JavaScript 调用
- **安全组合**: 模块间通过定义好的接口通信，保持沙箱隔离

### WASI (WebAssembly System Interface)

WASI 是 WASM 的系统接口标准，让 WASM 能访问操作系统功能：

| 版本 | 状态 | 关键特性 |
|------|------|----------|
| Preview 1 | 稳定 | 基础文件 IO、环境变量、随机数 |
| **Preview 2 (0.2)** | ✅ 2024 发布 | 组件模型、网络 socket、HTTP |
| Preview 3 (0.3) | 2025 预计 | 原生异步 I/O |
| WASI 1.0 | 待定 | 稳定版 |

---

## 2. WASI 0.2 的世界 (Worlds)

WASI 0.2 引入了 "World" 概念——针对特定领域的接口集合：

- `wasi-cli` - 命令行应用（参数、环境变量）
- `wasi-http` - HTTP 客户端/服务器
- `wasi-filesystem` - 文件和目录操作
- `wasi-sockets` - TCP/UDP 网络支持
- `wasi-clocks` - 时钟和定时器
- `wasi-random` - 密码学安全随机数

---

## 3. Rust 开发实战

### 3.1 命令行组件 (Command Component)

最简单的可执行组件：

```bash
# 创建项目
cargo new runnable-example

# 编写 main.rs
pub fn main() {
    eprintln!("Hello World!");
}

# 构建
cargo build --target=wasm32-wasip2

# 运行
wasmtime run ./target/wasm32-wasip2/debug/runnable-example.wasm
```

### 3.2 库组件 + 可运行 (Library + Runnable)

创建既能当库又能直接运行的组件：

**wit/component.wit:**
```wit
package example:runnable;

interface greet {
    greet: func(name: string) -> string;
}

world greeter {
    export greet;
    export wasi:cli/run@0.2.7;
}
```

**src/lib.rs:**
```rust
mod bindings {
    wit_bindgen::generate!();
    export!(Component);
}

struct Component;

// 实现自定义接口
impl bindings::exports::example::runnable::greet::Guest for Component {
    fn greet(name: String) -> String {
        format!("Hello {name}!")
    }
}

// 实现 wasi:cli/run 接口
impl bindings::exports::wasi::cli::run::Guest for Component {
    fn run() -> Result<(), ()> {
        eprintln!("Hello World!");
        Ok(())
    }
}
```

---

## 4. 主要运行时对比

| 运行时 | 特点 | WASI 0.2 支持 | 适用场景 |
|--------|------|---------------|----------|
| **Wasmtime** | Bytecode Alliance 官方，Rust 编写 | ✅ 首个完整支持 | 标准合规、安全优先 |
| **Wasmer** | 易嵌入，多语言绑定 | ✅ 支持 | 嵌入式、跨语言 |
| **WasmEdge** | CNCF 项目，云原生优化 | ⚠️ Preview1 + 扩展 | 边缘计算、高性能 |
| **WAMR** | 轻量级，嵌入式优化 | ⚠️ Preview1 | IoT、资源受限设备 |
| **Node.js** | 内置 wasi 模块 | ⚠️ 实验性，安全限制 | Node 生态集成 |

### 关键区别

- **Wasmtime**: 标准领导者，最快实现 WASI 0.2
- **Wasmer**: 推出 WASIX (WASI 扩展) 填补功能空白
- **WasmEdge**: 非阻塞 socket、HTTP 扩展，云原生优化

---

## 5. 当前技术限制

### 5.1 单线程限制
- WASM 默认可用单核
- 多线程提案正在推进，尚未标准化
- 影响：多核服务器场景性能受限

### 5.2 异步 I/O
- WASI 0.2 仍使用同步 I/O
- WASI 0.3 (Preview 3) 将引入原生异步
- 当前 workaround: 多实例或运行时特定扩展

### 5.3 浏览器支持滞后
- 组件模型在非浏览器运行时（Wasmtime）领先
- 浏览器环境仍在追赶
- 需要不同 "World" 或适配层

### 5.4 版本兼容性
- Preview 1 → Preview 2 有破坏性变更
- 需要适配器转换旧二进制
- 1.0 稳定版后承诺减少破坏性变更

---

## 6. 应用场景

### ✅ 适合 WASM + WASI 的场景

1. **Serverless / 边缘计算**
   - 冷启动 < 1ms（vs Lambda 100ms-8s）
   - 沙箱隔离，多租户安全

2. **插件系统**
   - 安全运行第三方代码
   - 跨语言插件生态

3. **微服务**
   - 轻量级部署
   - 快速扩缩容

4. **IoT / 嵌入式**
   - 小体积运行时
   - 安全隔离

### ⚠️ 仍需谨慎的场景

- 重度多线程应用（等待标准化）
- 需要完整 POSIX 兼容（考虑 WASIX）
- 高频主机-模块数据交换（边界开销）

---

## 7. 2025 趋势展望

1. **WASI 0.3 / Preview 3**
   - 原生异步 I/O 支持
   - 与 Component Model 深度集成

2. **浏览器组件模型支持**
   - 缩小浏览器与非浏览器环境差距
   - 真正的 "一次编译，到处运行"

3. **多语言生态成熟**
   - Python、Ruby、C# 支持改善
   - 垃圾回收、异常处理标准化

4. **AI + WASM**
   - wasi-nn (神经网络推理)
   - 边缘 AI 推理场景

---

## 8. 学习资源

- [Component Model 官方文档](https://component-model.bytecodealliance.org/)
- [WASI 提案仓库](https://github.com/WebAssembly/WASI)
- [Wasmtime 文档](https://docs.wasmtime.dev/)
- [Bytecode Alliance](https://bytecodealliance.org/)

---

## 9. 关键洞察

1. **组件模型是 WASM 的 "USB-C"**: 统一接口标准，跨语言互操作
2. **Wasmtime 是标准领导者**: 最快实现新规范，适合追求标准合规
3. **生态仍在快速演进**: 2024-2025 是关键成熟期，生产环境需谨慎评估
4. **Serverless 是杀手级应用**: 冷启动速度 + 安全隔离 = 完美匹配

---

> 🪞 孪生于不同世界，彼此映照，共同演化。
