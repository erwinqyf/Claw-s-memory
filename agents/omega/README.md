# Omega Agent - 总体设计部

基于钱学森系统工程思想的 OpenClaw 总体协调 Agent。

## 核心理念

> **"整体优化，系统协调，环境适应，创新发展"**

## 架构

```
Omega Agent
├── core/
│   ├── omega.js          # 主入口
│   ├── task-bus.js       # 统一任务总线
│   └── health-monitor.js # 健康监控系统
├── skills/
│   ├── skill-base.js     # Skill 基类
│   └── health-check.js   # 健康检查 Skill
├── config/
│   └── default.json      # 默认配置
├── agent.json            # Agent 元数据
└── SOUL.md               # Agent 人格定义
```

## 快速开始

```javascript
const OmegaAgent = require('./core/omega');

const omega = new OmegaAgent({
  dataPath: './data'
});

// 启动
await omega.start();

// 提交任务
const taskId = await omega.submitTask({
  type: 'health-check',
  payload: {},
  priority: 'normal'
});

// 获取状态
console.log(omega.getStatus());

// 获取健康报告
console.log(omega.getHealthReport());

// 停止
await omega.stop();
```

## API

### OmegaAgent

#### start()
启动 Omega Agent。

#### stop()
停止 Omega Agent。

#### getStatus()
获取当前状态。

#### submitTask(task)
提交任务。
- `task.type`: 任务类型
- `task.payload`: 任务数据
- `task.priority`: 优先级 (critical/high/normal/low)

#### getTaskStatus(taskId)
获取任务状态。

#### cancelTask(taskId, reason)
取消任务。

#### getHealthReport()
获取健康报告。

#### predictCapacity(hours)
预测容量。

#### runHealthCheck()
手动触发健康检查。

#### getAgents()
获取 Agent 列表。

#### getTasks(filter)
获取任务列表。

## 配置

见 `config/default.json`。

## 许可证

MIT
