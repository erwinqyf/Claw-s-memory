#!/usr/bin/env node
/**
 * 语言服务行业监控追踪器 v2.0
 * ===========================
 * 
 * 用途：监控全网语言服务行业相关方的新闻动态
 * 
 * 监控对象:
 * - 组织：Nimdzi, Slator, Multilingual
 * - 公司：TransPerfect, RWS, LanguageLine 等 (Nimdzi Top100)
 * 
 * 执行周期：每周二、四、六 11:00 (北京时间)
 * 交付形式：飞书云文档
 * 
 * 优化记录:
 * - v2.0 (2026-04-09): 重构代码结构、添加详细注释、改进错误处理、添加重试机制
 * - v1.0 (2026-03-17): 初始版本
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================================
// 配置与常量
// ============================================================================

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || path.join(process.env.HOME, '.openclaw', 'workspace');
const DATA_DIR = path.join(WORKSPACE_DIR, 'data');
const REPORTS_DIR = path.join(WORKSPACE_DIR, 'reports');

// 运行时配置
const CONFIG = {
  // HTTP 请求超时（毫秒）
  HTTP_TIMEOUT_MS: 10000,
  // 每个站点最大重试次数
  MAX_RETRIES: 2,
  // 重试间隔（毫秒）
  RETRY_DELAY_MS: 1000,
  // 每篇文章摘要最大长度
  MAX_SUMMARY_LENGTH: 500,
  // 状态文件保留的最大文章数
  MAX_STORED_ARTICLES: 100,
  // User-Agent 字符串
  USER_AGENT: 'Mozilla/5.0 (compatible; LanguageServiceMonitor/2.0)',
};

// 监控目标配置
const MONITOR_CONFIG = {
  organizations: [
    {
      name: 'Nimdzi',
      url: 'https://www.nimdzi.com',
      rssOrNews: '/insights/',
      type: 'organization',
      isMajor: true  // 标记为重点监控源
    },
    {
      name: 'Slator',
      url: 'https://slator.com',
      rssOrNews: '/news/',
      type: 'organization',
      isMajor: true
    },
    {
      name: 'Multilingual',
      url: 'https://multilingual.com',
      rssOrNews: '/blog/',
      type: 'organization',
      isMajor: false
    }
  ],
  companies: [
    // Top 10 (Nimdzi 2025)
    { name: 'TransPerfect', url: 'https://www.transperfect.com', newsPath: '/news' },
    { name: 'RWS', url: 'https://www.rws.com', newsPath: '/news' },
    { name: 'Keywords Studios', url: 'https://www.keywordsstudios.com', newsPath: '/news' },
    { name: 'Lionbridge', url: 'https://www.lionbridge.com', newsPath: '/news' },
    { name: 'LanguageLine Solutions', url: 'https://www.languageline.com', newsPath: '/news' },
    { name: 'Sorenson', url: 'https://www.sorensonvrs.com', newsPath: '/news' },
    { name: 'Iyuno', url: 'https://iyunugroup.com', newsPath: '/news' },
    { name: 'Propio Language Group', url: 'https://www.propiolanguage.com', newsPath: '/news' },
    { name: 'Acolad Group', url: 'https://www.acolad.com', newsPath: '/news' },
    { name: 'Welocalize', url: 'https://www.welocalize.com', newsPath: '/news' },
    
    // Top 11-30
    { name: 'DeepL', url: 'https://www.deepl.com', newsPath: '/blog' },
    { name: 'EC Innovations', url: 'https://www.ecinnovations.com', newsPath: '/news' },
    { name: 'GienTech', url: 'https://www.gientech.com', newsPath: '/news' },
    { name: 'Sunyu Transphere', url: 'https://www.sunyu.com', newsPath: '/news' },
    { name: 'Appen', url: 'https://appen.com', newsPath: '/news' },
    { name: 'Translate Plus', url: 'https://www.translateplus.com', newsPath: '/news' },
    { name: 'Centific', url: 'https://centific.com', newsPath: '/news' },
    { name: 'Trustpoint', url: 'https://trustpoint.one', newsPath: '/news' },
    { name: 'Smartling', url: 'https://www.smartling.com', newsPath: '/blog' },
    { name: 'Vistatec', url: 'https://www.vistatec.com', newsPath: '/news' },
    { name: 'Acclaro', url: 'https://www.acclaro.com', newsPath: '/news' },
    { name: 'Stepes', url: 'https://www.stepes.com', newsPath: '/blog' },
    { name: 'Gengo', url: 'https://gengo.com', newsPath: '/' },
    { name: 'OneHour Translation', url: 'https://www.onehourtranslation.com', newsPath: '/news' },
    { name: 'Tarjama', url: 'https://www.tarjama.com', newsPath: '/' },
    { name: 'Rask AI', url: 'https://www.rask.ai', newsPath: '/blog' },
    { name: 'Lilt', url: 'https://lilt.com', newsPath: '/blog' },
    { name: 'Memsource', url: 'https://www.memsource.com', newsPath: '/resources' },
    { name: 'XTM Cloud', url: 'https://www.xtm-cloud.com', newsPath: '/' },
    
    // Top 31-50
    { name: 'Day Translations', url: 'https://www.daytranslations.com', newsPath: '/' },
    { name: 'Tomedes', url: 'https://www.tomedes.com', newsPath: '/' },
    { name: 'Pangeanic', url: 'https://pangeanic.com', newsPath: '/' },
    { name: 'TextMaster', url: 'https://www.textmaster.com', newsPath: '/' },
    { name: 'Translated', url: 'https://www.translated.com', newsPath: '/blog' },
    { name: 'Wordbee', url: 'https://www.wordbee.com', newsPath: '/' },
    { name: 'Wordfast', url: 'https://www.wordfast.com', newsPath: '/' },
    { name: 'SDL', url: 'https://www.sdl.com', newsPath: '/' },
    { name: 'Trados', url: 'https://www.trados.com', newsPath: '/blog' },
    { name: 'Phrase', url: 'https://phrase.com', newsPath: '/blog' },
    { name: 'Crowdin', url: 'https://crowdin.com', newsPath: '/blog' },
    { name: 'Localize', url: 'https://localizejs.com', newsPath: '/' },
    { name: 'Lokalise', url: 'https://lokalise.com', newsPath: '/blog' },
    { name: 'Transifex', url: 'https://www.transifex.com', newsPath: '/blog' },
    { name: 'Globalization Partners', url: 'https://www.globalization-partners.com', newsPath: '/' },
    { name: 'Berlitz', url: 'https://www.berlitz.com', newsPath: '/' },
    { name: 'Rosetta Stone', url: 'https://www.rosettastone.com', newsPath: '/' },
    { name: 'EuroTalk', url: 'https://www.eurotalk.com', newsPath: '/' },
    { name: 'Inlingua', url: 'https://www.inlingua.com', newsPath: '/' },
    { name: 'Semantix', url: 'https://www.semantix.com', newsPath: '/' }
  ]
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 初始化目录结构
 * 确保数据目录和报告目录存在
 */
function initializeDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 创建数据目录: ${DATA_DIR}`);
  }
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    console.log(`📁 创建报告目录: ${REPORTS_DIR}`);
  }
}

/**
 * 延迟函数 - 用于重试间隔
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的 HTTP GET 请求
 * 
 * @param {string} url - 请求 URL
 * @param {boolean} followRedirect - 是否跟随重定向
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} - 返回 HTML 内容
 * @throws {Error} - 请求失败时抛出错误
 */
async function httpRequest(url, followRedirect = true, retryCount = 0) {
  try {
    return await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml'
        },
        timeout: CONFIG.HTTP_TIMEOUT_MS
      }, (res) => {
        // 处理重定向 (301, 302, 308)
        if ([301, 302, 308].includes(res.statusCode) && followRedirect && res.headers.location) {
          const redirectUrl = res.headers.location;
          console.log(`    ↪ 重定向到：${redirectUrl}`);
          httpRequest(redirectUrl, false).then(resolve).catch(reject);
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          }
        });
      }).on('error', reject);
    });
  } catch (err) {
    // 重试逻辑
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`    ⚠️ 请求失败，${CONFIG.RETRY_DELAY_MS}ms 后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
      await delay(CONFIG.RETRY_DELAY_MS);
      return httpRequest(url, followRedirect, retryCount + 1);
    }
    throw err;
  }
}


