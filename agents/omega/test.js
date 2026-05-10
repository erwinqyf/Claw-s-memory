/**
 * Omega Agent 测试脚本
 * 
 * 验证基础功能
 */

const OmegaAgent = require('./core/omega');
const path = require('path');

async function runTests() {
  console.log('================================');
  console.log('Omega Agent 功能测试');
  console.log('================================\n');
  
  const omega = new OmegaAgent({
    dataPath: path.join(__dirname, 'data')
  });
  
  // 测试 1: 启动
  console.log('测试 1: 启动 Omega Agent');
  await omega.start();
  console.log('✅ 启动成功\n');
  
  // 测试 2: 获取状态
  console.log('测试 2: 获取系统状态');
  const status = omega.getStatus();
  console.log('状态:', status.status);
  console.log('Agent 数量:', status.agents);
  console.log('SHI:', status.health.shi.toFixed(2));
  console.log('✅ 状态获取成功\n');
  
  // 测试 3: 获取 Agent 列表
  console.log('测试 3: 获取 Agent 列表');
  const agents = omega.getAgents();
  console.log('注册 Agent:');
  agents.forEach(agent => {
    console.log(`  - ${agent.id}: ${agent.status} (${agent.load})`);
  });
  console.log('✅ Agent 列表获取成功\n');
  
  // 测试 4: 提交任务
  console.log('测试 4: 提交任务');
  const taskId = await omega.submitTask({
    type: 'health-check',
    payload: { test: true },
    priority: 'normal'
  });
  console.log('任务 ID:', taskId);
  console.log('✅ 任务提交成功\n');
  
  // 测试 5: 获取任务状态
  console.log('测试 5: 获取任务状态');
  const taskStatus = omega.getTaskStatus(taskId);
  console.log('任务状态:', taskStatus.state);
  console.log('分配 Agent:', taskStatus.assignedTo);
  console.log('✅ 任务状态获取成功\n');
  
  // 测试 6: 获取健康报告
  console.log('测试 6: 获取健康报告');
  const report = omega.getHealthReport();
  console.log('当前 SHI:', report.current.shi.toFixed(2));
  console.log('告警数量:', report.alerts.length);
  console.log('建议数量:', report.recommendations.length);
  console.log('✅ 健康报告获取成功\n');
  
  // 测试 7: 容量预测
  console.log('测试 7: 容量预测');
  const prediction = omega.predictCapacity(24);
  console.log('当前 SHI:', prediction.current.toFixed(2));
  console.log('预测 SHI:', prediction.predicted.toFixed(2));
  console.log('风险等级:', prediction.riskLevel);
  console.log('✅ 容量预测成功\n');
  
  // 测试 8: 停止
  console.log('测试 8: 停止 Omega Agent');
  await omega.stop();
  console.log('✅ 停止成功\n');
  
  console.log('================================');
  console.log('所有测试通过 ✅');
  console.log('================================');
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
