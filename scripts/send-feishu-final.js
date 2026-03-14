#!/usr/bin/env node
/**
 * 发送飞书消息 - 语言服务监控报告 v2.1
 * 
 * 功能：通过飞书开放 API 发送交互式卡片消息
 * 使用场景：语言服务监控报告、夜间任务报告、晨间报告等
 * 
 * 流程：
 * 1. 使用 App ID/Secret 获取 tenant_access_token
 * 2. 使用 token 发送 interactive 类型消息（卡片）
 * 3. 输出发送结果和 Message ID
 * 
 * @see https://open.feishu.cn/document/ukTMzUjL4UDMwr7U2AzNzUTM
 */

const https = require('https');

/**
 * 飞书应用配置
 * 
 * 安全提示：
 * - 生产环境建议使用环境变量：process.env.FEISHU_APP_ID
 * - 或使用配置文件（.feishu-config.json）并加入 .gitignore
 * - 不要将密钥提交到 Git 仓库
 */
const CONFIG = {
  // 飞书应用凭证
  APP_ID: 'cli_a922b10c2362dbd3',
  APP_SECRET: 'NAcktALvcq9jPbZmWsUcyhQOhMlwlPdQ',
  
  // 接收者配置
  // 支持多种 ID 类型：open_id, user_id, chat_id, union_id
  OPEN_ID: 'ou_adcbc44a6fb7460391e585338f9e1e35',
  ID_TYPE: 'open_id',
  
  // API 端点
  API_BASE: 'open.feishu.cn',
  TOKEN_PATH: '/open-apis/auth/v3/tenant_access_token/internal',
  MESSAGE_PATH: '/open-apis/im/v1/messages',
  
  // 重试配置
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
};

/**
 * 主函数 - 执行消息发送流程
 * 
 * 步骤：
 * 1. 获取 tenant_access_token（应用级访问令牌）
 * 2. 构建交互式卡片消息
 * 3. 发送消息并输出结果
 */
async function main() {
  console.log('📤 发送语言服务监控报告到飞书...\n');
  
  try {
    // 步骤 1: 获取访问令牌（带重试机制）
    console.log('1️⃣ 获取 tenant_access_token...');
    const token = await getTenantTokenWithRetry();
    console.log('✅ Token 获取成功\n');
    
    // 步骤 2: 构建并发送卡片消息
    console.log('2️⃣ 发送卡片消息...');
    const card = buildMonitorReportCard();
    const result = await sendMessage(token, CONFIG.OPEN_ID, CONFIG.ID_TYPE, card);
    
    console.log('\n✅ 消息发送成功！');
    console.log(`Message ID: ${result.data.message_id}`);
    console.log(`发送时间：${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('\n❌ 发送失败:', error.message);
    throw error;
  }
}

/**
 * 构建语言服务监控报告卡片
 * 
 * 飞书卡片文档：https://open.feishu.cn/document/ukTMzUjL4UDMwr7U2AzNzUTM
 * 
 * @returns {Object} 卡片消息内容
 */
function buildMonitorReportCard() {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    config: {
      wide_screen_mode: true  // 宽屏模式，更好地展示内容
    },
    elements: [
      // 标题
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `# 📊 语言服务动态监控周报\n**日期:** ${today} | **版本:** v2.1 增强版`
        }
      },
      { tag: 'hr' },
      
      // 监控概况
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**📈 监控概况**
• 新增动态：37 条
• 趋势发现：TransPerfect (AI/ML 相关度高)
• 抓取成功：6 个网站
• 抓取失败：3 个网站`
        }
      },
      { tag: 'hr' },
      
      // 重点动态
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**🔥 重点动态**
• Slator: 7 条行业活动和资源
• TransPerfect: 10 条 (AI 翻译、视频翻译)
• RWS: 7 条 (AI 服务、本地化)
• Rask AI: 10 条 (免费翻译工具)`
        }
      },
      { tag: 'hr' },
      
      // 监控问题
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**⚠️ 监控问题**
• Nimdzi: 404
• Multilingual: 403
• DeepL: URL 错误`
        }
      },
      
      // 操作按钮
      {
        tag: 'action',
        elements: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '📄 GitHub 完整报告'
            },
            url: 'https://github.com/erwinqyf/Claw-s-memory/blob/main/reports/language-service-monitor-20260314-v2.md',
            type: 'primary'  // 主按钮（蓝色）
          },
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '🪞 飞书文档'
            },
            url: 'https://my.feishu.cn/wiki/J2Zhwn3mxiT6LckgkNbcyGvinid',
            type: 'default'  // 默认按钮（灰色）
          }
        ]
      }
    ]
  };
}

/**
 * 获取 tenant_access_token（带重试机制）
 * 
 * 重试策略：
 * - 最多重试 3 次
 * - 每次间隔 1 秒
 * - 适用于网络波动等临时错误
 * 
 * @returns {Promise<string>} tenant_access_token
 */
async function getTenantTokenWithRetry() {
  let lastError;
  
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await getTenantToken();
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ 尝试 ${attempt}/${CONFIG.MAX_RETRIES} 失败：${error.message}`);
      
      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(CONFIG.RETRY_DELAY_MS * attempt);  // 指数退避
      }
    }
  }
  
  throw new Error(`获取 Token 失败（已重试${CONFIG.MAX_RETRIES}次）: ${lastError.message}`);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 获取 tenant_access_token
 * 
 * 飞书内部应用获取应用级访问令牌
 * 有效期：2 小时，建议缓存复用
 * 
 * @returns {Promise<string>} tenant_access_token
 * @throws {Error} API 返回错误码或网络错误
 */
function getTenantToken() {
  return new Promise((resolve, reject) => {
    const requestData = {
      app_id: CONFIG.APP_ID,
      app_secret: CONFIG.APP_SECRET
    };
    
    const req = https.request({
      hostname: CONFIG.API_BASE,
      port: 443,
      path: CONFIG.TOKEN_PATH,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(requestData))
      }
    }, (res) => {
      let body = '';
      
      res.on('data', chunk => body += chunk);
      
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          
          // 检查 API 响应码
          if (result.code === 0) {
            resolve(result.tenant_access_token);
          } else {
            reject(new Error(`飞书 API 错误 [${result.code}]: ${result.msg}`));
          }
        } catch (parseError) {
          reject(new Error(`响应解析失败：${parseError.message}`));
        }
      });
    });
    
    // 处理请求错误（网络问题、DNS 等）
    req.on('error', (error) => {
      reject(new Error(`网络请求失败：${error.message}`));
    });
    
    // 设置超时（10 秒）
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时（10 秒）'));
    });
    
    req.write(JSON.stringify(requestData));
    req.end();
  });
}

/**
 * 发送飞书消息
 * 
 * 支持多种消息类型：
 * - interactive: 交互式卡片（推荐）
 * - text: 纯文本
 * - post: 富文本
 * - image: 图片
 * 
 * @param {string} token - tenant_access_token
 * @param {string} receiveId - 接收者 ID（open_id/user_id/chat_id 等）
 * @param {string} idType - ID 类型：open_id, user_id, chat_id, union_id
 * @param {Object} content - 消息内容（卡片结构）
 * @returns {Promise<Object>} API 响应（包含 message_id）
 * @throws {Error} 发送失败
 */
function sendMessage(token, receiveId, idType, content) {
  return new Promise((resolve, reject) => {
    const requestData = {
      receive_id: receiveId,
      msg_type: 'interactive',  // 交互式卡片
      content: JSON.stringify(content)
    };
    
    const req = https.request({
      hostname: CONFIG.API_BASE,
      port: 443,
      path: `${CONFIG.MESSAGE_PATH}?receive_id_type=${idType}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(JSON.stringify(requestData))
      }
    }, (res) => {
      let body = '';
      
      res.on('data', chunk => body += chunk);
      
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          
          if (result.code === 0) {
            resolve(result);
          } else {
            // 记录详细错误信息便于调试
            console.error('飞书 API 错误详情:', JSON.stringify(result, null, 2));
            reject(new Error(`发送失败 [${result.code}]: ${result.msg}`));
          }
        } catch (parseError) {
          reject(new Error(`响应解析失败：${parseError.message}`));
        }
      });
    });
    
    // 处理请求错误
    req.on('error', (error) => {
      reject(new Error(`网络请求失败：${error.message}`));
    });
    
    // 设置超时（15 秒）
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('请求超时（15 秒）'));
    });
    
    req.write(JSON.stringify(requestData));
    req.end();
  });
}

/**
 * 程序入口
 * 
 * 错误处理：
 * - 捕获所有未处理的错误
 * - 输出友好的错误信息
 * - 以非零状态码退出（便于 CI/CD 检测）
 */
main().catch(err => {
  console.error('\n❌ 程序执行失败:', err.message);
  console.error('\n💡 建议检查：');
  console.error('   1. 网络连接是否正常');
  console.error('   2. 飞书应用凭证是否正确');
  console.error('   3. 接收者 ID 是否有效');
  console.error('   4. 飞书 API 服务状态');
  console.error('\n完整错误堆栈:');
  console.error(err.stack);
  process.exit(1);
});
