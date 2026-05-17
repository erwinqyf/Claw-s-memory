#!/usr/bin/env node

/**
 * 修复 Cron 飞书投递问题
 * 
 * 问题：OpenClaw Issue #48889 - Feishu runtime not initialized in isolated sessions
 * 解决方案：移除 delivery 配置，让任务在内部使用 sessions_send
 */

const fs = require('fs');
const path = require('path');

const jobsPath = path.join(process.env.HOME, '.openclaw/cron/jobs.json');

console.log('🔧 开始修复 Cron 飞书投递配置...\n');

// 读取 jobs.json
const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));

let modified = false;

// 遍历所有任务
jobsData.jobs.forEach((job, index) => {
  // 只处理有 delivery 配置的任务
  if (!job.delivery) {
    return;
  }

  // 只处理飞书投递
  if (job.delivery.channel !== 'feishu') {
    return;
  }

  console.log(`📋 任务：${job.name} (${job.id})`);
  console.log(`   当前：sessionTarget=${job.sessionTarget}, delivery.mode=${job.delivery.mode}`);

  // 对于 isolated session 的任务，移除 delivery 配置
  // 因为 isolated session 无法访问 Feishu runtime
  if (job.sessionTarget === 'isolated') {
    console.log(`   ⚠️  Isolated session 无法使用 Feishu delivery`);
    console.log(`   ✅ 移除 delivery 配置，请确保任务内部使用 sessions_send`);
    
    // 检查 payload 中是否已经有 sessions_send 的说明
    const payload = job.payload.message || job.payload.text || '';
    if (payload.includes('sessions_send')) {
      console.log(`   ✅ Payload 已包含 sessions_send 指令`);
    } else {
      console.log(`   ⚠️  Payload 缺少 sessions_send 指令，需要手动添加`);
    }
    
    delete job.delivery;
    modified = true;
  } 
  // 对于 main session 的任务，保留 delivery 配置
  else if (job.sessionTarget === 'main') {
    console.log(`   ✅ Main session 可以使用 delivery`);
    console.log(`   保留 delivery 配置`);
  }

  console.log('');
});

// 保存修改
if (modified) {
  fs.writeFileSync(jobsPath, JSON.stringify(jobsData, null, 2), 'utf-8');
  console.log('✅ 配置已保存到 ~/.openclaw/cron/jobs.json\n');
  console.log('📝 下一步：');
  console.log('   1. 检查 isolated 任务的 payload 是否包含 sessions_send 指令');
  console.log('   2. 如不包含，使用 openclaw cron edit 添加');
  console.log('   3. 手动触发一个任务测试飞书通知是否正常\n');
} else {
  console.log('✅ 无需修改\n');
}
