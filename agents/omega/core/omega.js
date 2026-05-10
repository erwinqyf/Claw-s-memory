/**
 * Omega Agent - 总体设计部
 * 
 * 基于钱学森系统工程思想的核心实现
 * 负责任务编排、状态监控、资源管理、决策支持
 * 
 * @version 1.0.0
 * @author Claw
 */

const TaskBus = require('./task-bus');
const HealthMonitor = require('./health-monitor');
const fs = require('fs').promises;
const path = require('path');

class OmegaAgent {
  constructor(config = {}) {
    this.config = {
      dataPath: config.dataPath || './data',
      persistenceInterval: config.persistenceInterval || 60000,
      ...config
    };
    
    // 核心组件
    this.taskBus = new TaskBus({
      persistencePath: path.join(this.config.dataPath, 'tasks')
    });
    
    this.healthMonitor = new HealthMonitor({
      checkInterval: 60000
    });
    
    // 状态
    this.status = 'initializing';
    this.startedAt = null;
    
    // 绑定事件
    this._bindEvents();
  }
  
  /**
   * 启动 Omega Agent
   */
  async start() {
    console.log('[Omega] Starting...');
    
    // 1. 加载配置
    await this._loadConfig();
    
    // 2. 注册管理的 Agent
    await this._registerManagedAgents();
    
    // 3. 启动健康监控
    this._startHealthMonitoring();
    
    // 4. 启动持久化
    this._startPersistence();
    
    this.status = 'running';
    this.startedAt = Date.now();
    
    console.log('[Omega] Started successfully');
    console.log(`[Omega] Managing ${this.taskBus.agents.size} agents`);
    
    return true;
  }
  
  /**
   * 停止 Omega Agent
   */
  async stop() {
    console.log('[Omega] Stopping...');
    this.status = 'stopping';
    
    // 持久化状态
    await this._persistState();
    
    this.status = 'stopped';
    console.log('[Omega] Stopped');
    
    return true;
  }
  
  /**
   * 获取状态
   */
  getStatus() {
    return {
      status: this.status,
      startedAt: this.startedAt,
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
      health: this.taskBus.getSystemHealth(),
      agents: this.taskBus.agents.size,
      tasks: this.taskBus.tasks.size,
      queue: this.taskBus.getQueueStatus()
    };
  }
  
  /**
   * 提交任务
   */
  async submitTask(task) {
    return await this.taskBus.submit(task);
  }
  
  /**
   * 获取任务状态
   */
  getTaskStatus(taskId) {
    return this.taskBus.getTaskStatus(taskId);
  }
  
  /**
   * 取消任务
   */
  async cancelTask(taskId, reason) {
    return await this.taskBus.cancel(taskId, reason);
  }
  
  /**
   * 获取健康报告
   */
  getHealthReport() {
    return this.healthMonitor.getHealthReport();
  }
  
  /**
   * 获取容量预测
   */
  predictCapacity(hours = 24) {
    return this.healthMonitor.predictCapacity(hours);
  }
  
  /**
   * 手动触发健康检查
   */
  async runHealthCheck() {
    const health = this.taskBus.getSystemHealth();
    this.healthMonitor.recordSnapshot(health);
    return health;
  }
  
  /**
   * 获取 Agent 列表
   */
  getAgents() {
    return Array.from(this.taskBus.agents.values()).map(agent => ({
      id: agent.id,
      status: agent.status,
      load: `${agent.currentLoad}/${agent.capacity}`,
      capabilities: Array.from(agent.capabilities),
      lastHeartbeat: agent.lastHeartbeat,
      stats: agent.stats
    }));
  }
  
  /**
   * 获取任务列表
   */
  getTasks(filter = {}) {
    let tasks = Array.from(this.taskBus.tasks.values());
    
    if (filter.state) {
      tasks = tasks.filter(t => t.state === filter.state);
    }
    if (filter.agent) {
      tasks = tasks.filter(t => t.assignedTo === filter.agent);
    }
    if (filter.priority) {
      tasks = tasks.filter(t => t.priority === filter.priority);
    }
    
    return tasks.map(t => ({
      id: t.id,
      type: t.type,
      state: t.state,
      priority: t.priority,
      assignedTo: t.assignedTo,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      retries: t.retries
    }));
  }
  
  /**
   * 手动迁移任务
   */
  async migrateTasks(fromAgentId, toAgentId = null) {
    const tasks = this.getTasks({ agent: fromAgentId, state: 'running' });
    
    for (const task of tasks) {
      if (toAgentId) {
        // 迁移到指定 Agent
        const agent = this.taskBus.agents.get(toAgentId);
        if (agent && agent.status === 'online') {
          task.assignedTo = toAgentId;
          await this.taskBus._notifyAgent(agent, task);
        }
      } else {
        // 重新分配
        await this.taskBus._migrateAgentTasks(fromAgentId);
      }
    }
    
    return { migrated: tasks.length };
  }
  
  // ============ 私有方法 ============
  
  _bindEvents() {
    // Task Bus 事件
    this.taskBus.on('task:submitted', (task) => {
      console.log(`[Omega] Task submitted: ${task.id}`);
    });
    
    this.taskBus.on('task:completed', (task) => {
      console.log(`[Omega] Task completed: ${task.id}`);
    });
    
    this.taskBus.on('task:failed', (task) => {
      console.warn(`[Omega] Task failed: ${task.id} - ${task.error}`);
    });
    
    this.taskBus.on('agent:offline', ({ agentId }) => {
      console.warn(`[Omega] Agent offline: ${agentId}`);
      this.healthMonitor._createAlert(
        'agent_offline',
        'critical',
        `Agent ${agentId} 离线`,
        { agentId }
      );
    });
    
    this.taskBus.on('agent:online', ({ agentId }) => {
      console.log(`[Omega] Agent online: ${agentId}`);
    });
    
    // Health Monitor 事件
    this.healthMonitor.on('alert:created', (alert) => {
      console.warn(`[Omega] Alert: [${alert.severity}] ${alert.message}`);
    });
    
    this.healthMonitor.on('monitor:tick', () => {
      const health = this.taskBus.getSystemHealth();
      this.healthMonitor.recordSnapshot(health);
    });
  }
  
  async _loadConfig() {
    try {
      const configPath = path.join(this.config.dataPath, 'config.json');
      const data = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(data);
      // 合并配置
      Object.assign(this.config, config);
      console.log('[Omega] Config loaded');
    } catch (err) {
      console.log('[Omega] Using default config');
    }
  }
  
  async _registerManagedAgents() {
    // 注册管理的 Agent
    const agents = [
      {
        id: 'alpha',
        capabilities: ['task-execution', 'report-generation', 'code-optimization'],
        capacity: 5
      },
      {
        id: 'bravo',
        capabilities: ['monitoring', 'review', 'analysis'],
        capacity: 3
      },
      {
        id: 'charlie',
        capabilities: ['memory-management', 'consolidation', 'heartbeat'],
        capacity: 3
      },
      {
        id: 'delta',
        capabilities: ['report-generation', 'data-collection', 'notification'],
        capacity: 4
      },
      {
        id: 'echo',
        capabilities: ['intelligence', 'tracking', 'research'],
        capacity: 3
      }
    ];
    
    for (const agent of agents) {
      this.taskBus.registerAgent(agent);
    }
    
    console.log('[Omega] Agents registered');
  }
  
  _startHealthMonitoring() {
    // 初始健康检查
    const health = this.taskBus.getSystemHealth();
    this.healthMonitor.recordSnapshot(health);
    
    console.log('[Omega] Health monitoring started');
    console.log(`[Omega] Initial SHI: ${health.shi.toFixed(2)} (${health.level})`);
  }
  
  _startPersistence() {
    // 定期持久化
    setInterval(async () => {
      await this._persistState();
    }, this.config.persistenceInterval);
    
    console.log('[Omega] Persistence started');
  }
  
  async _persistState() {
    try {
      const state = {
        timestamp: Date.now(),
        status: this.status,
        stats: this.taskBus.stats,
        health: this.taskBus.getSystemHealth()
      };
      
      const statePath = path.join(this.config.dataPath, 'state.json');
      await fs.mkdir(this.config.dataPath, { recursive: true });
      await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('[Omega] Failed to persist state:', err.message);
    }
  }
}

module.exports = OmegaAgent;