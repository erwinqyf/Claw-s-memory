/**
 * Health Check Skill - 系统健康检查
 * 
 * Omega Agent 的核心 Skill
 * 基于钱学森系统工程思想：科学管理
 * 
 * @version 1.0.0
 * @skill
 */

const Skill = require('./skill-base');

class HealthCheckSkill extends Skill {
  constructor() {
    super({
      name: 'health-check',
      description: '系统健康检查和报告',
      version: '1.0.0',
      capabilities: ['health-monitoring', 'reporting', 'alerting']
    });
    
    this.schedule = '0 */1 * * *'; // 每小时
  }
  
  async execute(context) {
    const { omega } = context;
    
    console.log('[Skill:health-check] Running health check...');
    
    // 1. 执行健康检查
    const health = await omega.runHealthCheck();
    
    // 2. 获取健康报告
    const report = omega.getHealthReport();
    
    // 3. 获取容量预测
    const prediction = omega.predictCapacity(24);
    
    // 4. 生成报告
    const output = this._generateReport(health, report, prediction);
    
    // 5. 如果有告警，发送通知
    if (report.alerts.length > 0) {
      await this._sendAlertNotification(report.alerts);
    }
    
    return {
      success: true,
      shi: health.shi,
      level: health.level,
      alerts: report.alerts.length,
      recommendations: report.recommendations.length,
      output
    };
  }
  
  _generateReport(health, report, prediction) {
    const lines = [
      '## 系统健康检查报告',
      '',
      `**检查时间**: ${new Date().toISOString()}`,
      `**SHI 指数**: ${health.shi.toFixed(2)} (${this._getLevelEmoji(health.level)})`,
      '',
      '### 指标详情',
      ''
    ];
    
    // 指标
    Object.entries(health.metrics).forEach(([key, value]) => {
      lines.push(`- **${key}**: ${(value * 100).toFixed(1)}%`);
    });
    
    lines.push('', '### Agent 状态', '');
    lines.push(`- 在线: ${health.agents.online}/${health.agents.total}`);
    lines.push(`- 负载: ${health.agents.totalLoad}/${health.agents.totalCapacity}`);
    
    lines.push('', '### 任务状态', '');
    lines.push(`- 总任务: ${health.tasks.total}`);
    lines.push(`- 运行中: ${health.tasks.running}`);
    lines.push(`- 已完成: ${health.tasks.completed}`);
    lines.push(`- 失败: ${health.tasks.failed}`);
    
    lines.push('', '### 队列状态', '');
    Object.entries(health.queue).forEach(([key, value]) => {
      if (key !== 'total') {
        lines.push(`- ${key}: ${value}`);
      }
    });
    
    lines.push('', '### 告警', '');
    if (report.alerts.length === 0) {
      lines.push('✅ 无活跃告警');
    } else {
      report.alerts.forEach(alert => {
        lines.push(`- [${alert.severity}] ${alert.message}`);
      });
    }
    
    lines.push('', '### 建议', '');
    if (report.recommendations.length === 0) {
      lines.push('✅ 系统运行良好');
    } else {
      report.recommendations.forEach(rec => {
        lines.push(`- [${rec.priority}] ${rec.action}`);
      });
    }
    
    lines.push('', '### 容量预测 (24h)', '');
    lines.push(`- 当前 SHI: ${prediction.current.toFixed(2)}`);
    lines.push(`- 预测 SHI: ${prediction.predicted.toFixed(2)}`);
    lines.push(`- 风险等级: ${prediction.riskLevel}`);
    lines.push(`- 建议: ${prediction.recommendation}`);
    
    return lines.join('\n');
  }
  
  _getLevelEmoji(level) {
    const emojis = {
      healthy: '🟢',
      warning: '🟡',
      critical: '🔴'
    };
    return emojis[level] || '⚪';
  }
  
  async _sendAlertNotification(alerts) {
    // 这里可以集成飞书/邮件通知
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.warn('[Skill:health-check] Critical alerts detected:', criticalAlerts.length);
      // TODO: 发送飞书通知
    }
  }
}

module.exports = HealthCheckSkill;
