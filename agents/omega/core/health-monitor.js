/**
 * Health Monitor - 系统健康监控
 * 
 * 基于钱学森系统工程思想：科学管理
 * 定量指标体系，数据驱动决策
 * 
 * @version 1.0.0
 * @author Omega Agent
 */

const EventEmitter = require('events');

class HealthMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      checkInterval: config.checkInterval || 60000, // 1分钟
      historyWindow: config.historyWindow || 24 * 60 * 60 * 1000, // 24小时
      thresholds: {
        shi: { healthy: 0.9, warning: 0.7 },
        agentAvailability: { healthy: 0.8, warning: 0.6 },
        taskSuccessRate: { healthy: 0.95, warning: 0.8 },
        queueHealth: { healthy: 0.7, warning: 0.4 },
        resourceUtilization: { healthy: 0.85, warning: 0.95 }
      },
      ...config
    };
    
    // 历史数据
    this.history = [];
    
    // 告警状态
    this.alerts = new Map();
    
    // 趋势分析
    this.trends = {
      shi: [],
      agentAvailability: [],
      taskSuccessRate: []
    };
    
    // 启动监控
    this._startMonitoring();
  }
  
  /**
   * 记录健康快照
   */
  recordSnapshot(health) {
    const snapshot = {
      timestamp: Date.now(),
      shi: health.shi,
      level: health.level,
      metrics: health.metrics,
      agents: health.agents,
      tasks: health.tasks
    };
    
    this.history.push(snapshot);
    
    // 更新趋势
    this._updateTrends(snapshot);
    
    // 清理旧数据
    this._cleanupHistory();
    
    // 检查告警
    this._checkAlerts(snapshot);
    
    return snapshot;
  }
  
  /**
   * 获取当前健康报告
   */
  getHealthReport() {
    const current = this.history[this.history.length - 1];
    if (!current) return null;
    
    return {
      current: current,
      trends: this._calculateTrends(),
      predictions: this._predictHealth(),
      alerts: Array.from(this.alerts.values()),
      recommendations: this._generateRecommendations(current)
    };
  }
  
  /**
   * 获取历史趋势
   */
  getTrends(metric, duration = 3600000) {
    const cutoff = Date.now() - duration;
    return this.history
      .filter(h => h.timestamp > cutoff)
      .map(h => ({
        timestamp: h.timestamp,
        value: h.metrics[metric] || h[metric]
      }));
  }
  
  /**
   * 获取告警列表
   */
  getAlerts(activeOnly = true) {
    const alerts = Array.from(this.alerts.values());
    if (activeOnly) {
      return alerts.filter(a => a.status === 'active');
    }
    return alerts;
  }
  
  /**
   * 确认告警
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = Date.now();
      this.emit('alert:acknowledged', alert);
      return true;
    }
    return false;
  }
  
  /**
   * 解决告警
   */
  resolveAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }
  
  /**
   * 获取容量预测
   */
  predictCapacity(hours = 24) {
    const trend = this._calculateTrends();
    const current = this.history[this.history.length - 1];
    
    if (!current || !trend) return null;
    
    // 简单线性预测
    const shiTrend = trend.shi || 0;
    const predictedShi = current.shi + (shiTrend * hours);
    
    return {
      current: current.shi,
      predicted: Math.max(0, Math.min(1, predictedShi)),
      trend: shiTrend,
      riskLevel: predictedShi < 0.7 ? 'high' : predictedShi < 0.9 ? 'medium' : 'low',
      recommendation: this._getCapacityRecommendation(predictedShi)
    };
  }
  
  // ============ 私有方法 ============
  
  _updateTrends(snapshot) {
    const window = 10; // 最近10个点
    
    Object.keys(this.trends).forEach(key => {
      this.trends[key].push(snapshot.metrics[key] || snapshot[key]);
      if (this.trends[key].length > window) {
        this.trends[key].shift();
      }
    });
  }
  
  _calculateTrends() {
    const trends = {};
    
    Object.keys(this.trends).forEach(key => {
      const values = this.trends[key];
      if (values.length < 2) {
        trends[key] = 0;
        return;
      }
      
      // 简单线性回归斜率
      const n = values.length;
      const sumX = values.reduce((a, b, i) => a + i, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = values.reduce((a, b, i) => a + i * b, 0);
      const sumXX = values.reduce((a, b, i) => a + i * i, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      trends[key] = slope;
    });
    
    return trends;
  }
  
  _predictHealth() {
    const trends = this._calculateTrends();
    const current = this.history[this.history.length - 1];
    
    if (!current) return null;
    
    // 预测未来1小时
    const predictions = {
      '1h': {},
      '24h': {}
    };
    
    Object.keys(trends).forEach(key => {
      const currentValue = current.metrics[key] || current[key];
      predictions['1h'][key] = currentValue + trends[key];
      predictions['24h'][key] = currentValue + trends[key] * 24;
    });
    
    return predictions;
  }
  
  _checkAlerts(snapshot) {
    const { thresholds } = this.config;
    
    // SHI 告警
    if (snapshot.shi < thresholds.shi.warning) {
      this._createAlert('shi_critical', 'critical', 
        `SHI 低于警告阈值: ${snapshot.shi.toFixed(2)}`,
        { shi: snapshot.shi, threshold: thresholds.shi.warning }
      );
    } else if (snapshot.shi < thresholds.shi.healthy) {
      this._createAlert('shi_warning', 'warning',
        `SHI 低于健康阈值: ${snapshot.shi.toFixed(2)}`,
        { shi: snapshot.shi, threshold: thresholds.shi.healthy }
      );
    }
    
    // Agent 可用率告警
    const aa = snapshot.metrics.agentAvailability;
    if (aa < thresholds.agentAvailability.warning) {
      this._createAlert('agent_availability_critical', 'critical',
        `Agent 可用率过低: ${(aa * 100).toFixed(1)}%`,
        { availability: aa }
      );
    }
    
    // 任务成功率告警
    const tsr = snapshot.metrics.taskSuccessRate;
    if (tsr < thresholds.taskSuccessRate.warning) {
      this._createAlert('task_success_rate_warning', 'warning',
        `任务成功率下降: ${(tsr * 100).toFixed(1)}%`,
        { successRate: tsr }
      );
    }
    
    // 队列健康告警
    const qh = snapshot.metrics.queueHealth;
    if (qh < thresholds.queueHealth.warning) {
      this._createAlert('queue_health_warning', 'warning',
        `队列压力过高: ${((1 - qh) * 100).toFixed(1)}%`,
        { queueHealth: qh }
      );
    }
    
    // 资源利用率告警
    const ru = snapshot.metrics.resourceUtilization;
    if (ru > thresholds.resourceUtilization.warning) {
      this._createAlert('resource_utilization_critical', 'critical',
        `资源利用率过高: ${(ru * 100).toFixed(1)}%`,
        { utilization: ru }
      );
    }
  }
  
  _createAlert(id, severity, message, data) {
    const existing = this.alerts.get(id);
    
    if (existing && existing.status === 'active') {
      // 更新现有告警
      existing.count++;
      existing.lastOccurred = Date.now();
      existing.data = data;
    } else {
      // 创建新告警
      const alert = {
        id: `${id}_${Date.now()}`,
        type: id,
        severity,
        message,
        data,
        status: 'active',
        createdAt: Date.now(),
        lastOccurred: Date.now(),
        count: 1,
        acknowledgedAt: null,
        resolvedAt: null
      };
      
      this.alerts.set(alert.id, alert);
      this.emit('alert:created', alert);
      
      console.log(`[Omega] Alert created: [${severity}] ${message}`);
    }
  }
  
  _generateRecommendations(snapshot) {
    const recommendations = [];
    
    // 基于 SHI 的建议
    if (snapshot.shi < 0.7) {
      recommendations.push({
        priority: 'critical',
        category: 'system',
        action: '立即检查系统状态',
        reason: 'SHI 处于危险水平'
      });
    } else if (snapshot.shi < 0.9) {
      recommendations.push({
        priority: 'high',
        category: 'system',
        action: '优化系统配置',
        reason: 'SHI 处于警告水平'
      });
    }
    
    // 基于 Agent 可用率的建议
    if (snapshot.metrics.agentAvailability < 0.8) {
      recommendations.push({
        priority: 'critical',
        category: 'agents',
        action: '检查离线 Agent',
        reason: 'Agent 可用率不足'
      });
    }
    
    // 基于任务成功率的建议
    if (snapshot.metrics.taskSuccessRate < 0.95) {
      recommendations.push({
        priority: 'high',
        category: 'tasks',
        action: '分析失败任务根因',
        reason: '任务成功率下降'
      });
    }
    
    // 基于队列健康的建议
    if (snapshot.metrics.queueHealth < 0.4) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        action: '增加 Agent 容量或优化任务处理',
        reason: '队列压力过高'
      });
    }
    
    // 基于资源利用率的建议
    if (snapshot.metrics.resourceUtilization > 0.95) {
      recommendations.push({
        priority: 'high',
        category: 'capacity',
        action: '扩容或优化资源使用',
        reason: '资源利用率过高'
      });
    }
    
    return recommendations;
  }
  
  _getCapacityRecommendation(predictedShi) {
    if (predictedShi < 0.5) {
      return '系统将在24小时内进入危险状态，建议立即扩容';
    } else if (predictedShi < 0.7) {
      return '系统健康度持续下降，建议准备扩容方案';
    } else if (predictedShi < 0.9) {
      return '系统负载增加，建议监控并优化性能';
    } else {
      return '系统健康度良好，当前容量充足';
    }
  }
  
  _cleanupHistory() {
    const cutoff = Date.now() - this.config.historyWindow;
    this.history = this.history.filter(h => h.timestamp > cutoff);
  }
  
  _startMonitoring() {
    setInterval(() => {
      this.emit('monitor:tick');
    }, this.config.checkInterval);
    
    console.log('[Omega] Health monitor started');
  }
}

module.exports = HealthMonitor;