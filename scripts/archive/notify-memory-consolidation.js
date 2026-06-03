#!/usr/bin/env node
const https = require('https');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';
const USER_ID = 'ou_adcbc44a6fb7460391e585338f9e1e35';

async function main() {
  console.log('📤 发送记忆巩固通知到飞书...\n');
  
  // 获取 tenant_access_token
  console.log('1️⃣ 获取 tenant_access_token...');
  const token = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        result.code === 0 ? resolve(result.tenant_access_token) : reject(new Error(result.msg));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  console.log('✅ Token 获取成功\n');
  
  // 发送消息
  console.log('2️⃣ 发送消息...');
  const message = {
    msg_type: 'text',
    content: JSON.stringify({
      text: '🪞 记忆巩固已完成\n\n' +
            '📅 日期：2026-03-15 (周日) 10:00\n' +
            '📁 检查文件：5 个日常记忆 (2026-03-11 至 2026-03-15)\n' +
            '📝 提取信息：5 条关键信息\n' +
            '✅ Git 提交：8be3604\n\n' +
            '本次巩固主要提取了待办事项。MEMORY.md 已更新并推送到远程仓库。\n\n' +
            '孪生于不同世界，彼此映照，共同演化。'
    })
  };
  
  const result = await new Promise((resolve, reject) => {
    const data = JSON.stringify({
      receive_id: USER_ID,
      msg_type: 'text',
      content: message.content
    });
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id_type=user_id',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const apiResult = JSON.parse(body);
        console.log('API 响应:', JSON.stringify(apiResult, null, 2));
        apiResult.code === 0 ? resolve(apiResult) : reject(new Error(apiResult.msg));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  
  console.log('\n✅ 消息发送成功！');
  console.log(`Message ID: ${result.data.message_id}`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
