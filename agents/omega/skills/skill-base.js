/**
 * Skill Base Class - Skill 基类
 * 
 * 所有 Omega Agent Skill 的基类
 * 
 * @version 1.0.0
 */

class Skill {
  constructor(config = {}) {
    this.name = config.name;
    this.description = config.description;
    this.version = config.version || '1.0.0';
    this.capabilities = config.capabilities || [];
    this.schedule = config.schedule || null; // Cron 表达式
    this.enabled = config.enabled !== false;
    
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRun: null,
      avgExecutionTime: 0
    };
  }
  
  /**
   * 执行 Skill
   * 子类必须实现
   */
  async execute(context) {
    throw new Error('Skill must implement execute method');
  }
  
  /**
   * 验证 Skill 是否可以执行
   */
  canExecute(context) {
    return this.enabled;
  }
  
  /**
   * 获取 Skill 信息
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      capabilities: this.capabilities,
      schedule: this.schedule,
      enabled: this.enabled,
      stats: this.stats
    };
  }
  
  /**
   * 更新统计
   */
  _updateStats(success, executionTime) {
    this.stats.totalRuns++;
    this.stats.lastRun = Date.now();
    
    if (success) {
      this.stats.successfulRuns++;
    } else {
      this.stats.failedRuns++;
    }
    
    // 更新平均执行时间
    const total = this.stats.totalRuns;
    this.stats.avgExecutionTime = 
      (this.stats.avgExecutionTime * (total - 1) + executionTime) / total;
  }
}

module.exports = Skill;
