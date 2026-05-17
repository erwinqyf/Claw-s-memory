#!/usr/bin/env node
/**
 * Task Metrics Wrapper
 * 任务执行包装器 - 自动记录任务指标
 * 
 * 使用方法：在现有脚本中引入此模块
 * const { wrapTask } = require('./task-metrics-wrapper');
 * 
 * 然后包装你的任务函数：
 * const wrappedTask = wrapTask(originalTask, {
 *   taskType: 'cron',
 *   agentId: 'alpha',
 *   description: '夜间自主任务'
 * });
 */

const metrics = require('./task-metrics-collector');

/**
 * 包装任务函数，自动记录执行指标
 * @param {Function} fn - 原始任务函数
 * @param {Object} meta - 任务元数据
 * @returns {Function} 包装后的函数
 */
function wrapTask(fn, {
  taskType = 'unknown',
  agentId = 'main',
  description = 'Unnamed task'
}) {
  return async function(...args) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();
    let status = 'success';
    let errorType = null;
    let errorMessage = null;
    let toolsUsed = [];
    let tokenCount = 0;
    
    try {
      // 执行原始任务
      const result = await fn(...args);
      
      // 尝试从结果中提取工具使用信息
      if (result && result._meta) {
        toolsUsed = result._meta.toolsUsed || [];
        tokenCount = result._meta.tokenCount || 0;
      }
      
      return result;
    } catch (error) {
      status = 'failed';
      errorMessage = error.message;
      
      // 分类错误类型
      if (error.message.includes('timeout')) {
        status = 'timeout';
        errorType = 'timeout';
      } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        errorType = 'network';
      } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
        errorType = 'permission';
      } else {
        errorType = 'unknown';
      }
      
      throw error;
    } finally {
      const endTime = new Date().toISOString();
      
      // 记录任务
      try {
        metrics.recordTask({
          taskId,
          taskType,
          agentId,
          description,
          startTime,
          endTime,
          status,
          errorType,
          errorMessage,
          toolsUsed,
          tokenCount
        });
      } catch (e) {
        console.error('Failed to record metrics:', e.message);
      }
    }
  };
}

/**
 * 快速记录任务（用于无法包装的场景）
 * @param {Object} taskData - 任务数据
 */
function quickRecord(taskData) {
  try {
    return metrics.recordTask({
      taskType: taskData.taskType || 'unknown',
      agentId: taskData.agentId || 'main',
      description: taskData.description || 'Quick recorded task',
      status: taskData.status || 'success',
      errorType: taskData.errorType || null,
      errorMessage: taskData.errorMessage || null,
      ...taskData
    });
  } catch (e) {
    console.error('Failed to quick record:', e.message);
  }
}

/**
 * 生成并发送每日报告
 * @param {string} date - 日期（可选，默认今天）
 * @returns {string} 报告内容
 */
async function generateAndSendDailyReport(date) {
  const report = metrics.generateDailyReport(date);
  if (!report) {
    return 'No data for report';
  }
  
  const md = metrics.exportMarkdown(report, 'daily');
  
  // 保存到文件
  const fs = require('fs');
  const path = require('path');
  const reportsDir = path.join(__dirname, '..', 'reports', 'metrics');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const file = path.join(reportsDir, `daily-${report.date}.md`);
  fs.writeFileSync(file, md);
  
  return md;
}

module.exports = {
  wrapTask,
  quickRecord,
  generateAndSendDailyReport,
  metrics
};