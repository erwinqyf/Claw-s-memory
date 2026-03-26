#!/usr/bin/env node

/**
 * 批量修复所有 cron 任务的 sessions_send 配置
 * 修复 sessionKey 格式问题
 */

const fs = require('fs');
const path = require('path');

const jobsPath = path.join(process.env.HOME, '.openclaw/cron/jobs.json');
const CORRECT_SESSION_KEY = 'agent:main:feishu:group:oc_544ef0ac66f15f18550668c007ee8566';
const WRONG_SESSION_KEY = 'oc_544ef0ac66f15f18550668c007ee8566';

console.log('🔧 批量修复 cron 任务的 sessions_send 配置...\n');

const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
let fixedCount = 0;

jobsData.jobs.forEach((job, index) => {
  if (!job.payload || !job.payload.message) {
    return;
  }

  const oldMessage = job.payload.message;
  
  // 修复 sessionKey 格式
  const newMessage = oldMessage.replace(
    new RegExp(`sessionKey:\\s*["']${WRONG_SESSION_KEY}["']`, 'g'),
    `sessionKey: "${CORRECT_SESSION_KEY}"`
  );

  if (oldMessage !== newMessage) {
    console.log(`✅ 修复：${job.name}`);
    console.log(`   旧：sessionKey: "${WRONG_SESSION_KEY}"`);
    console.log(`   新：sessionKey: "${CORRECT_SESSION_KEY}"`);
    job.payload.message = newMessage;
    fixedCount++;
  }
});

if (fixedCount > 0) {
  fs.writeFileSync(jobsPath, JSON.stringify(jobsData, null, 2), 'utf-8');
  console.log(`\n✅ 已修复 ${fixedCount} 个任务的配置`);
  console.log('📝 下次任务执行时将使用正确的 sessionKey\n');
} else {
  console.log('\n✅ 所有任务配置已正确\n');
}
