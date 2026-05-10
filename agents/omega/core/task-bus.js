/**
 * Task Bus - 统一任务总线
 * 
 * 基于钱学森系统工程思想：综合集成
 * 所有任务通过总线流转，实现统一调度
 * 
 * @version 1.0.0
 * @author Omega Agent
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class TaskBus extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // 配置
    this.config = {
      maxQueueSize: config.maxQueueSize || 1000,
      defaultTimeout: config.defaultTimeout || 300000, // 5分钟
      maxRetries: config.maxRetries || 3,
      persistencePath: config.persistencePath || './data/tasks',
      ...config
    };
    
    // 任务队列（按优先级）
    this.queues = {
      critical: [],    // P0 - 关键
      high: [],        // P1 - 高优先级
      normal: [],     // P2 - 普通
      low: []          // P3 - 低优先级
    };
    
    // 任务状态映射
    this.tasks = new Map();
    
    // Agent 注册表
    this.agents = new Map();
    
    // 统计信息
    this.stats = {
      totalSubmitted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalRetried: 0,
      avgProcessingTime: 0
    };
    
    // 启动持久化
    this._initPersistence();
    
    // 启动监控
    this._startMonitoring();
  }
  
  /**
   * 注册 Agent
   */
  registerAgent(agentConfig) {
    const { id, capabilities, capacity = 10 } = agentConfig;
    
    this.agents.set(id, {
      id,
      capabilities: new Set(capabilities),
      capacity,
      currentLoad: 0,
      status: 'online',
      lastHeartbeat: Date.now(),
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgProcessingTime: 0
      }
    });
    
    this.emit('agent:registered', { agentId: id });
    console.log(`[Omega] Agent registered: ${id}`);
    
    return true;
  }
  
  /**
   * 提交任务
   */
  async submit(task) {
    // 1. 任务验证
    const validation = this._validateTask(task);
    if (!validation.valid) {
      throw new Error(`Task validation failed: ${validation.error}`);
    }
    
    // 2. 创建任务对象
    const taskObj = {
      id: this._generateTaskId(),
      type: task.type,
      payload: task.payload,
      priority: task.priority || 'normal',
      assignedTo: null,
      state: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeout: task.timeout || this.config.defaultTimeout,
      retries: 0,
      maxRetries: task.maxRetries || this.config.maxRetries,
      result: null,
      error: null
    };
    
    // 3. 存储任务
    this.tasks.set(taskObj.id, taskObj);
    
    // 4. 路由决策
    const agent = this._selectAgent(taskObj);
    if (!agent) {
      taskObj.state = 'failed';
      taskObj.error = 'No available agent';
      this.emit('task:failed', taskObj);
      throw new Error('No available agent for task');
    }
    
    // 5. 分配任务
    taskObj.assignedTo = agent.id;
    taskObj.state = 'assigned';
    
    // 6. 入队
    this.queues[taskObj.priority].push(taskObj);
    
    // 7. 更新 Agent 负载
    agent.currentLoad++;
    
    // 8. 通知 Agent
    await this._notifyAgent(agent, taskObj);
    
    // 9. 更新统计
    this.stats.totalSubmitted++;
    
    // 10. 持久化
    await this._persistTask(taskObj);
    
    // 11. 触发事件
    this.emit('task:submitted', taskObj);
    
    console.log(`[Omega] Task submitted: ${taskObj.id} → ${agent.id}`);
    
    return taskObj.id;
  }
  
  /**
   * 任务状态流转
   */
  async transition(taskId, newState, data = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const oldState = task.state;
    
    // 状态机验证
    const validTransitions = {
      'pending': ['assigned', 'cancelled'],
      'assigned': ['running', 'failed'],
      'running': ['completed', 'failed', 'timeout'],
      'completed': [],
      'failed': ['retrying', 'cancelled'],
      'retrying': ['assigned'],
      'timeout': ['retrying', 'failed'],
      'cancelled': []
    };
    
    if (!validTransitions[oldState]?.includes(newState)) {
      throw new Error(`Invalid state transition: ${oldState} → ${newState}`);
    }
    
    // 更新状态
    task.state = newState;
    task.updatedAt = Date.now();
    
    // 处理数据
    if (data.result !== undefined) task.result = data.result;
    if (data.error !== undefined) task.error = data.error;
    
    // 特殊状态处理
    switch (newState) {
      case 'completed':
        this.stats.totalCompleted++;
        this._updateAgentStats(task.assignedTo, task);
        break;
        
      case 'failed':
        this.stats.totalFailed++;
        if (task.retries < task.maxRetries) {
          await this._retryTask(task);
        } else {
          this._updateAgentStats(task.assignedTo, task, true);
        }
        break;
        
      case 'timeout':
        console.warn(`[Omega] Task timeout: ${taskId}`);
        break;
    }
    
    // 持久化
    await this._persistTask(task);
    
    // 触发事件
    this.emit(`task:${newState}`, task);
    
    return task;
  }
  
  /**
   * 心跳更新
   */
  heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`[Omega] Unknown agent heartbeat: ${agentId}`);
      return false;
    }
    
    agent.lastHeartbeat = Date.now();
    if (agent.status !== 'online') {
      agent.status = 'online';
      this.emit('agent:online', { agentId });
      console.log(`[Omega] Agent back online: ${agentId}`);
    }
    
    return true;
  }
  
  /**
   * 获取系统健康度
   */
  getSystemHealth() {
    const agentStats = this._getAgentStats();
    const taskStats = this._getTaskStats();
    
    // SHI 计算
    const metrics = {
      agentAvailability: agentStats.online / agentStats.total,
      taskSuccessRate: this.stats.totalSubmitted > 0 
        ? this.stats.totalCompleted / this.stats.totalSubmitted 
        : 1,
      queueHealth: this._getQueueHealth(),
      resourceUtilization: this._getResourceUtilization()
    };
    
    // 加权计算
    const weights = {
      agentAvailability: 0.25,
      taskSuccessRate: 0.25,
      queueHealth: 0.25,
      resourceUtilization: 0.25
    };
    
    const shi = Object.entries(metrics).reduce((sum, [key, value]) => {
      return sum + (value * weights[key]);
    }, 0);
    
    return {
      shi: Math.round(shi * 100) / 100,
      level: shi >= 0.9 ? 'healthy' : shi >= 0.7 ? 'warning' : 'critical',
      metrics,
      agents: agentStats,
      tasks: taskStats,
      timestamp: Date.now()
    };
  }
  
  /**
   * 获取任务状态
   */
  getTaskStatus(taskId) {
    return this.tasks.get(taskId);
  }
  
  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      critical: this.queues.critical.length,
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length,
      total: Object.values(this.queues).reduce((a, b) => a + b.length, 0)
    };
  }
  
  /**
   * 取消任务
   */
  async cancel(taskId, reason = '') {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    if (['completed', 'failed', 'cancelled'].includes(task.state)) {
      throw new Error(`Cannot cancel task in state: ${task.state}`);
    }
    
    await this.transition(taskId, 'cancelled', { error: reason });
    
    return true;
  }
  
  // ============ 私有方法 ============
  
  _validateTask(task) {
    if (!task.type) {
      return { valid: false, error: 'Task type is required' };
    }
    if (!task.payload) {
      return { valid: false, error: 'Task payload is required' };
    }
    const validPriorities = ['critical', 'high', 'normal', 'low'];
    if (task.priority && !validPriorities.includes(task.priority)) {
      return { valid: false, error: `Invalid priority: ${task.priority}` };
    }
    return { valid: true };
  }
  
  _generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  _selectAgent(task) {
    // 获取可用 Agent
    const available = Array.from(this.agents.values())
      .filter(a => a.status === 'online' && a.currentLoad < a.capacity);
    
    if (available.length === 0) return null;
    
    // 计算匹配分数
    const scored = available.map(agent => {
      // 负载分数 (越低越好)
      const loadScore = agent.currentLoad / agent.capacity;
      
      // 技能匹配 (是否支持该任务类型)
      const skillMatch = agent.capabilities.has(task.type) ? 1 : 0.5;
      
      // 历史错误率
      const totalTasks = agent.stats.tasksCompleted + agent.stats.tasksFailed;
      const errorRate = totalTasks > 0 ? agent.stats.tasksFailed / totalTasks : 0;
      
      // 综合评分
      const score = (loadScore * 0.4) + ((1 - skillMatch) * 0.3) + (errorRate * 0.3);
      
      return { agent, score };
    });
    
    // 选择最优
    scored.sort((a, b) => a.score - b.score);
    return scored[0].agent;
  }
  
  async _notifyAgent(agent, task) {
    // 触发事件，由外部监听并实际通知 Agent
    this.emit('task:notify', { agentId: agent.id, task });
  }
  
  async _retryTask(task) {
    task.retries++;
    task.state = 'retrying';
    task.error = null;
    task.assignedTo = null;
    
    this.stats.totalRetried++;
    
    // 延迟后重新提交
    setTimeout(async () => {
      await this.transition(task.id, 'assigned');
      const newAgent = this._selectAgent(task);
      if (newAgent) {
        task.assignedTo = newAgent.id;
        newAgent.currentLoad++;
        await this._notifyAgent(newAgent, task);
        this.emit('task:retry', task);
      }
    }, 1000 * Math.pow(2, task.retries)); // 指数退避
  }
  
  _updateAgentStats(agentId, task, failed = false) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.currentLoad = Math.max(0, agent.currentLoad - 1);
    
    const processingTime = Date.now() - task.createdAt;
    
    if (failed) {
      agent.stats.tasksFailed++;
    } else {
      agent.stats.tasksCompleted++;
    }
    
    // 更新平均处理时间
    const total = agent.stats.tasksCompleted + agent.stats.tasksFailed;
    agent.stats.avgProcessingTime = 
      (agent.stats.avgProcessingTime * (total - 1) + processingTime) / total;
  }
  
  _getAgentStats() {
    const agents = Array.from(this.agents.values());
    return {
      total: agents.length,
      online: agents.filter(a => a.status === 'online').length,
      offline: agents.filter(a => a.status !== 'online').length,
      totalLoad: agents.reduce((sum, a) => sum + a.currentLoad, 0),
      totalCapacity: agents.reduce((sum, a) => sum + a.capacity, 0)
    };
  }
  
  _getTaskStats() {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.state === 'pending').length,
      running: tasks.filter(t => t.state === 'running').length,
      completed: tasks.filter(t => t.state === 'completed').length,
      failed: tasks.filter(t => t.state === 'failed').length
    };
  }
  
  _getQueueHealth() {
    const status = this.getQueueStatus();
    const maxSize = this.config.maxQueueSize;
    return 1 - (status.total / maxSize);
  }
  
  _getResourceUtilization() {
    const agentStats = this._getAgentStats();
    if (agentStats.totalCapacity === 0) return 0;
    return agentStats.totalLoad / agentStats.totalCapacity;
  }
  
  async _initPersistence() {
    try {
      await fs.mkdir(this.config.persistencePath, { recursive: true });
      // 加载持久化任务
      await this._loadPersistedTasks();
    } catch (err) {
      console.warn('[Omega] Failed to init persistence:', err.message);
    }
  }
  
  async _loadPersistedTasks() {
    // 从磁盘加载未完成的任务
    // 简化实现：实际应从数据库加载
    console.log('[Omega] Persistence initialized');
  }
  
  async _persistTask(task) {
    // 简化实现：实际应写入数据库
    // const filePath = path.join(this.config.persistencePath, `${task.id}.json`);
    // await fs.writeFile(filePath, JSON.stringify(task, null, 2));
  }
  
  _startMonitoring() {
    // Agent 心跳超时检测
    setInterval(() => {
      const now = Date.now();
      const timeout = 90000; // 90秒
      
      for (const agent of this.agents.values()) {
        if (agent.status === 'online' && now - agent.lastHeartbeat > timeout) {
          agent.status = 'offline';
          this.emit('agent:offline', { agentId: agent.id });
          console.warn(`[Omega] Agent offline: ${agent.id}`);
          
          // 迁移该 Agent 的任务
          this._migrateAgentTasks(agent.id);
        }
      }
    }, 30000); // 30秒检查一次
    
    // 任务超时检测
    setInterval(() => {
      const now = Date.now();
      
      for (const task of this.tasks.values()) {
        if (task.state === 'running' && now - task.updatedAt > task.timeout) {
          this.transition(task.id, 'timeout');
        }
      }
    }, 60000); // 60秒检查一次
    
    console.log('[Omega] Monitoring started');
  }
  
  _migrateAgentTasks(agentId) {
    // 将离线 Agent 的任务重新分配
    for (const task of this.tasks.values()) {
      if (task.assignedTo === agentId && ['assigned', 'running'].includes(task.state)) {
        task.assignedTo = null;
        task.state = 'pending';
        
        // 重新提交
        this.submit({
          type: task.type,
          payload: task.payload,
          priority: task.priority
        }).catch(err => {
          console.error(`[Omega] Failed to migrate task ${task.id}:`, err);
        });
      }
    }
  }
}

module.exports = TaskBus;