#!/usr/bin/env node
/**
 * 写入飞书知识库 - 语言服务监控报告 v2.1
 */

const https = require('https');
const fs = require('fs');

const APP_ID = 'cli_a922b10c2362dbd3';
const APP_SECRET = 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ';
const WIKI_TOKEN = 'IuVJdqS6uoYWOWxEz60cgfWXnh7';

async function main() {
  console.log('📝 写入飞书知识库...\n');
  
  // 1. 获取 tenant_access_token
  console.log('1️⃣ 获取 tenant_access_token...');
  const token = await getTenantToken();
  console.log('✅ Token 获取成功\n');
  
  // 2. 读取 Markdown 内容
  console.log('2️⃣ 读取 Markdown 内容...');
  const markdown = fs.readFileSync('/home/admin/.openclaw/workspace/reports/language-service-feishu-summary.md', 'utf-8');
  console.log(`✅ 读取成功 (${markdown.length} 字符)\n`);
  
  // 3. 获取知识库节点信息
  console.log('3️⃣ 获取节点信息...');
  try {
    const nodeInfo = await getWikiNode(token, WIKI_TOKEN);
    console.log('✅ 节点信息获取成功');
    console.log(`   Node Token: ${nodeInfo.obj_token}`);
    console.log(`   Title: ${nodeInfo.title}\n`);
    
    // 4. 更新节点内容
    console.log('4️⃣ 更新节点内容...');
    const result = await updateWikiNode(token, nodeInfo.obj_token, markdown);
    console.log('\n✅ 知识库更新成功！');
    console.log(`Wiki Token: ${WIKI_TOKEN}`);
  } catch (err) {
    console.log('⚠️ Wiki API 不可用，尝试直接发送消息...');
    console.log('\n📄 文档内容已准备好，请手动复制到飞书：\n');
    console.log('='.repeat(60));
    console.log(markdown);
    console.log('='.repeat(60));
  }
}

function getTenantToken() {
  return new Promise((resolve, reject) => {
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
}

function getWikiNode(token, wikiToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: `/open-apis/wiki/v1/nodes/${wikiToken}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.code === 0 && result.data) {
            resolve(result.data);
          } else {
            reject(new Error(result.msg || 'Failed to get wiki node'));
          }
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function updateWikiNode(token, objToken, content) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      obj_token: objToken,
      content: content
    });
    
    const req = https.request({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/wiki/v1/nodes/content',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('HTTP Status:', res.statusCode);
        console.log('Response:', body.slice(0, 500));
        
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(body);
            result.code === 0 ? resolve(result) : reject(new Error(result.msg));
          } catch (e) {
            resolve({ message: 'Content updated' });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
