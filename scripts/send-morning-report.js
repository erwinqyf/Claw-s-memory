#!/usr/bin/env node
/**
 * 发送晨间报告到飞书
 * 
 * 用法：node scripts/send-morning-report.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  APP_ID: 'cli_a922b10c2362dbd3',
  APP_SECRET: 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ',
  OPEN_ID: 'ou_adcbc44a6fb7460391e585338f9e1e35',
  ID_TYPE: 'open_id',
  API_BASE: 'open.feishu.cn',
  TOKEN_PATH: '/open-apis/auth/v3/tenant_access_token/internal',
  MESSAGE_PATH: '/open-apis/im/v1/messages'
};

function request(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.API_BASE,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getToken() {
  const result = await request(CONFIG.TOKEN_PATH, 'POST', {
    app_id: CONFIG.APP_ID,
    app_secret: CONFIG.APP_SECRET
  });
  if (result.code !== 0) throw new Error(`Token error: ${result.msg}`);
  return result.tenant_access_token;
}

async function sendReport() {
  console.log('📤 发送晨间报告到飞书...\n');
  
  const token = await getToken();
  console.log('✅ Token 获取成功\n');
  
  const card = {
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: 'div',
        text: {
          content: '# 🌅 晨间报告 - 2026-03-17\n**昨夜状态:** ⚠️ 定时任务故障已修复\n**报告时间:** 07:00 AM (Asia/Shanghai)',
          tag: 'lark_md'
        }
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: { content: '**⚠️ 故障与修复**\n\n**问题:** `nightly-autonomous-midnight` 定时任务 00:00 触发时飞书投递失败\n\n**根因:** cron 配置了 `delivery` 但未指定目标地址\n\n**修复:**\n✅ 01:32 手动修复配置\n✅ 06:00 ClawHub 追踪任务已自动恢复\n✅ 系统现已正常运行', tag: 'lark_md' }
      },
      {
        tag: 'div',
        text: { content: '**✅ 完成的工作**\n\n• 记忆整理 → memory/2026-03-16.md\n• 配置修复 → cron jobs.json\n• 健康检查 → 3 次检查，问题已恢复\n• Git 同步 → 5 次提交，已推送', tag: 'lark_md' }
      },
      {
        tag: 'div',
        text: { content: '**🔍 当前状态**\n\n| 系统 | 状态 |\n|------|------|\n| Cron 调度器 | ✅ 正常 |\n| 记忆系统 | ✅ 正常 |\n| ClawHub 追踪 | ✅ 已恢复 |\n| 飞书通知 | ⚠️ 待配置 |', tag: 'lark_md' }
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { content: '📄 查看夜间任务报告', tag: 'plain_text' },
            url: 'https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/nightly-report-2026-03-16.md',
            type: 'default'
          },
          {
            tag: 'button',
            text: { content: '🏥 查看健康检查报告', tag: 'plain_text' },
            url: 'https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/cron-health-check-2026-03-16.md',
            type: 'default'
          }
        ]
      }
    ]
  };
  
  const result = await request(`${CONFIG.MESSAGE_PATH}?receive_id_type=${CONFIG.ID_TYPE}`, 'POST', {
    receive_id: CONFIG.OPEN_ID,
    msg_type: 'interactive',
    content: JSON.stringify(card)
  }, token);
  
  if (result.code !== 0) throw new Error(`Send error: ${result.msg}`);
  
  console.log('✅ 消息发送成功！');
  console.log(`Message ID: ${result.data.message_id}`);
  return result;
}

sendReport().catch(err => {
  console.error('❌ 发送失败:', err.message);
  process.exit(1);
});
