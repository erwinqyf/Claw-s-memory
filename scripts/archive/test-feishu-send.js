#!/usr/bin/env node
const https = require('https');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';
const USER_ID = 'ou_adcbc44a6fb7460391e585338f9e1e35';

async function main() {
  console.log('📤 发送语言服务监控报告到飞书...\n');
  
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
  
  // 发送消息 - 使用 user_id
  console.log('2️⃣ 发送消息 (使用 user_id)...');
  const message = {
    msg_type: 'text',
    content: JSON.stringify({
      text: '📊 语言服务动态监控报告 (2026-03-13)\n\n' +
            '监控概况:\n- 监控范围：3 个组织 + 49 个公司\n- 新增动态：40 条\n- 抓取成功率：90%+\n\n' +
            '重点新闻:\n- TransPerfect 2025 年营收增长 7% 至 13.2 亿美元\n- Smartling 发布 LLM 翻译企业应用指南\n- 多家头部 LSP 发布 AI 相关服务\n\n' +
            '完整报告：https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/language-service-monitor-20260313.md'
    })
  };
  
  const result = await new Promise((resolve, reject) => {
    const data = JSON.stringify({
      msg_type: 'text',
      content: message.content
    });
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id=' + encodeURIComponent(USER_ID) + '&receive_id_type=user_id',
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
