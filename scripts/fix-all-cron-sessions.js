#!/usr/bin/env node

/**
 * Cron 任务飞书通知诊断与修复工具 v2.0
 * ======================================
 * 
 * 用途：诊断并修复 cron 任务的飞书通知问题
 * 检查项：
 * 1. sessionKey 格式是否正确
 * 2. 飞书账号配置是否存在
 * 3. Gateway 服务状态
 * 4. 飞书群聊连接状态
 * 
 * 用法：node scripts/fix-all-cron-sessions.js
 * 
 * 优化记录:
 * - v2.0 (2026-03-28): 添加飞书账号配置检查、Gateway 状态检查、群聊连接诊断
 * - v1.0 (2026-03-26): 初始版本 - 仅修复 sessionKey 格式
 * 
 * 已知问题:
 * - "Feishu account 'main' not configured" - 需重启 Gateway 或重新配置飞书插件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JOBS_PATH = path.join(process.env.HOME, '.openclaw/cron/jobs.json');
const FEISHU_CONFIG_PATH = path.join(process.env.HOME, '.openclaw/config/feishu.json');
const CORRECT_SESSION_KEY = 'agent:main:feishu:group:oc_544ef0ac66f15f18550668c007ee8566';
const WRONG_SESSION_KEY = 'oc_544ef0ac66f15f18550668c007ee8566';

console.log('🔍 Cron 任务飞书通知诊断与修复工具 v2.0\n');
console.log('=' .repeat(50) + '\n');

// 诊断函数
function diagnoseFeishuConfig() {
  console.log('📋 诊断步骤 1/4: 检查飞书账号配置\n');
  
  if (!fs.existsSync(FEISHU_CONFIG_PATH)) {
    console.log('❌ 飞书配置文件不存在:', FEISHU_CONFIG_PATH);
    console.log('💡 建议：运行 openclaw config feishu 配置飞书账号\n');
    return false;
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(FEISHU_CONFIG_PATH, 'utf-8'));
    if (config.accounts && config.accounts.main) {
      console.log('✅ 飞书账号 "main" 已配置');
      console.log(`   App ID: ${config.accounts.main.appId || '未设置'}`);
      console.log(`   用户 ID: ${config.accounts.main.userId || '未设置'}\n`);
      return true;
    } else {
      console.log('❌ 飞书账号 "main" 未找到');
      console.log('   可用账号:', Object.keys(config.accounts || {}));
      console.log('💡 建议：检查 ~/.openclaw/config/feishu.json 配置\n');
      return false;
    }
  } catch (e) {
    console.log('❌ 读取飞书配置失败:', e.message);
    console.log('💡 建议：配置文件可能损坏，需重新配置\n');
    return false;
  }
}

function diagnoseGatewayStatus() {
  console.log('📋 诊断步骤 2/4: 检查 Gateway 服务状态\n');
  
  try {
    const status = execSync('openclaw gateway status', { encoding: 'utf-8', timeout: 5000 });
    if (status.includes('running') || status.includes('active')) {
      console.log('✅ Gateway 服务运行中');
      console.log(status.trim() + '\n');
      return true;
    } else {
      console.log('⚠️ Gateway 服务状态异常');
      console.log(status.trim() + '\n');
      console.log('💡 建议：运行 openclaw gateway restart 重启服务\n');
      return false;
    }
  } catch (e) {
    console.log('❌ Gateway 服务检查失败:', e.message);
    console.log('💡 建议：运行 openclaw gateway start 启动服务\n');
    return false;
  }
}

function diagnoseGroupConnection() {
  console.log('📋 诊断步骤 3/4: 检查飞书群聊连接\n');
  
  try {
    const groups = execSync('openclaw directory groups list --channel feishu', { encoding: 'utf-8', timeout: 10000 });
    if (groups.includes('No groups found') || groups.trim() === '') {
      console.log('⚠️ Bot 未加入任何飞书群聊');
      console.log('💡 建议：');
      console.log('   1. 在飞书创建群聊「孪生团队协作中心」');
      console.log('   2. 邀请 Bot 加入群聊');
      console.log('   3. 获取群聊 ID 并更新 cron 配置\n');
      return false;
    } else {
      console.log('✅ Bot 已加入群聊:');
      console.log(groups.trim() + '\n');
      return true;
    }
  } catch (e) {
    console.log('⚠️ 群聊检查失败:', e.message);
    console.log('💡 建议：检查飞书 Bot 权限配置\n');
    return false;
  }
}

function fixSessionKeys() {
  console.log('📋 诊断步骤 4/4: 修复 sessionKey 配置\n');
  
  if (!fs.existsSync(JOBS_PATH)) {
    console.log('❌ jobs.json 不存在:', JOBS_PATH);
    return 0;
  }
  
  const jobsData = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8'));
  let fixedCount = 0;
  
  jobsData.jobs.forEach((job) => {
    if (!job.payload || !job.payload.message) {
      return;
    }
    
    const oldMessage = job.payload.message;
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
    fs.writeFileSync(JOBS_PATH, JSON.stringify(jobsData, null, 2), 'utf-8');
    console.log(`\n✅ 已修复 ${fixedCount} 个任务的 sessionKey 配置`);
  } else {
    console.log('✅ 所有任务 sessionKey 配置已正确');
  }
  console.log();
  
  return fixedCount;
}

function printSummary(feishuOk, gatewayOk, groupsOk, fixedCount) {
  console.log('=' .repeat(50));
  console.log('📊 诊断总结\n');
  
  const checks = [
    { name: '飞书账号配置', ok: feishuOk },
    { name: 'Gateway 服务状态', ok: gatewayOk },
    { name: '飞书群聊连接', ok: groupsOk },
    { name: 'sessionKey 修复', ok: fixedCount >= 0 },
  ];
  
  let allOk = true;
  checks.forEach(({ name, ok }) => {
    console.log(`${ok ? '✅' : '❌'} ${name}`);
    if (!ok) allOk = false;
  });
  
  console.log();
  
  if (allOk) {
    console.log('🎉 所有检查通过！飞书通知应该正常工作');
  } else {
    console.log('⚠️ 发现问题，按以下顺序修复:');
    if (!feishuOk) console.log('   1. 配置飞书账号：openclaw config feishu');
    if (!gatewayOk) console.log('   2. 重启 Gateway: openclaw gateway restart');
    if (!groupsOk) console.log('   3. 创建群聊并邀请 Bot 加入');
    console.log('\n💡 最常见解决方案：openclaw gateway restart');
  }
  console.log();
}

// 主流程
try {
  const feishuOk = diagnoseFeishuConfig();
  const gatewayOk = diagnoseGatewayStatus();
  const groupsOk = diagnoseGroupConnection();
  const fixedCount = fixSessionKeys();
  
  printSummary(feishuOk, gatewayOk, groupsOk, fixedCount);
  
} catch (e) {
  console.error('❌ 诊断过程出错:', e.message);
  console.error(e.stack);
  process.exit(1);
}
