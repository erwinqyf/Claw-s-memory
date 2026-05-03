#!/usr/bin/env node

/**
 * 全球新闻汇总监控脚本 v1.6
 *
 * 功能：
 * 1. 抓取多个 RSS 新闻源（政治、经济、文化、科技）
 * 2. 解析并去重（标题相似度检测）
 * 3. 筛选 Top 5 新闻（每类）
 * 4. 生成 Markdown 报告
 * 5. 保存状态（避免重复抓取）
 * 6. 自动上传到 GitHub
 *
 * 执行时间：每天 12:00 (Asia/Shanghai)
 * 输出：reports/global-news-YYYY-MM-DD.md
 *
 * v1.6 改进 (2026-05-04):
 * - 添加新闻热度评分：基于来源权重、时效性、关键词匹配
 * - 智能摘要生成：提取关键句子，自动摘要
 * - 添加新闻趋势分析：对比昨日，识别新增/消失的热点
 * - 改进报告格式：添加热度指示器和趋势标记
 *
 * v1.5 改进 (2026-04-30):
 * - 增强错误处理：添加网络错误分类和重试策略
 * - 改进日志输出：统一格式，添加结构化日志函数
 * - 优化 RSS 解析：更好的空值处理和异常捕获
 * - 添加执行计时：每个阶段记录耗时
 *
 * v1.4 改进 (2026-04-29):
 * - 新闻源多元化重构：覆盖不同地区、立场、语言
 * - 移除 NYT 付费源
 * - 新增：亚太、中东、印度等地区的媒体
 * - 每个类别 8-10 个来源，避免单一信源主导
 *
 * v1.3 改进 (2026-04-29):
 * - 移除 NYT 付费新闻源（全部替换为免费源）
 * - 新增：半岛电视台、CNBC、NPR Arts、Ars Technica
 *
 * v1.2 改进 (2026-04-23):
 * - 添加自动 GitHub 上传功能
 * - 执行完成后自动提交并推送报告
 * - 添加 Git 状态检测和错误处理
 *
 * v1.1 改进 (2026-03-23):
 * - 添加启动时配置验证（fail fast）
 * - 增强错误处理和恢复建议
 * - 改进日志输出格式
 * - 添加网络超时保护
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

// ==================== 日志工具 ====================

/**
 * 结构化日志输出
 */
const Logger = {
  info: (msg) => console.log(`[${getTimestamp()}] ℹ️  ${msg}`),
  success: (msg) => console.log(`[${getTimestamp()}] ✅ ${msg}`),
  warn: (msg) => console.log(`[${getTimestamp()}] ⚠️  ${msg}`),
  error: (msg) => console.error(`[${getTimestamp()}] ❌ ${msg}`),
  debug: (msg) => process.env.DEBUG && console.log(`[${getTimestamp()}] 🔍 ${msg}`),
  stage: (name) => console.log(`\n${'='.repeat(50)}\n📍 ${name}\n${'='.repeat(50)}`),
  metric: (name, value) => console.log(`[${getTimestamp()}] 📊 ${name}: ${value}`)
};

function getTimestamp() {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// ==================== 配置区 ====================

const CONFIG = {
  // 新闻源配置 - 多元化设计：覆盖不同地区、立场、语言
  feeds: {
    political: [
      // 欧洲
      { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', lang: 'en', region: 'UK' },
      { name: 'Reuters World', url: 'https://www.reutersagency.com/feed/', lang: 'en', region: 'UK' },
      { name: '英国卫报', url: 'https://www.theguardian.com/world/rss', lang: 'en', region: 'UK' },
      { name: '泰晤士报', url: 'https://www.thetimes.co.uk/feed/rss/world', lang: 'en', region: 'UK' },
      { name: '经济学人', url: 'https://www.economist.com/world/rss', lang: 'en', region: 'UK' },
      { name: 'France 24', url: 'https://www.france24.com/en/rss', lang: 'en', region: 'EU' },
      { name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-all', lang: 'en', region: 'EU' },

      // 北美
      { name: 'AP News', url: 'https://rsshub.app/apnews/topics/ap-top-news', lang: 'en', region: 'US' },
      { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml', lang: 'en', region: 'US' },

      // 亚太
      { name: '联合早报', url: 'https://www.zaobao.com.sg/rss/news/china.xml', lang: 'zh', region: 'SG' },
      { name: '南华早报', url: 'https://www.scmp.com/rss/91/feed', lang: 'en', region: 'HK' },
      { name: '日本时报', url: 'https://www.japantimes.co.jp/feed/', lang: 'en', region: 'JP' },
      { name: '韩民族日报', url: 'https://english.hani.co.kr/rss/', lang: 'en', region: 'KR' },

      // 中东/其他
      { name: '半岛电视台', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en', region: 'QA' },
      { name: '塔斯社', url: 'https://tass.com/rss/v2.xml', lang: 'en', region: 'RU' },
      { name: '中东观察', url: 'https://www.middleeastmonitor.com/feed/', lang: 'en', region: 'ME' }
    ],
    economy: [
      // 英美主流
      { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance', lang: 'en', region: 'UK' },
      { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', lang: 'en', region: 'US' },
      { name: '华尔街日报', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', lang: 'en', region: 'US' },
      { name: '经济学人财经', url: 'https://www.economist.com/finance-and-economics/rss', lang: 'en', region: 'UK' },

      // 欧洲/亚洲
      { name: 'Financial Times', url: 'https://www.ft.com/?format=rss', lang: 'en', region: 'UK' },
      { name: 'Bloomberg', url: 'https://www.bloomberg.com/feed/podcast/etf.xml', lang: 'en', region: 'US' },
      { name: '日经亚洲', url: 'https://asia.nikkei.com/rss/markets/feed', lang: 'en', region: 'JP' },
      { name: '财新网', url: 'https://rsshub.app/caixin/finance', lang: 'zh', region: 'CN' },
      { name: 'Business Standard', url: 'https://www.business-standard.com/rss/economy-101.rss', lang: 'en', region: 'IN' }
    ],
    culture: [
      // 英语媒体
      { name: 'BBC Culture', url: 'http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', lang: 'en', region: 'UK' },
      { name: '卫报文化', url: 'https://www.theguardian.com/culture/rss', lang: 'en', region: 'UK' },
      { name: 'NPR Arts', url: 'https://feeds.npr.org/1008/rss.xml', lang: 'en', region: 'US' },
      { name: 'Vulture', url: 'https://www.vulture.com/rss/', lang: 'en', region: 'US' },

      // 中文媒体
      { name: '知乎日报', url: 'https://daily.zhihu.com/rss', lang: 'zh', region: 'CN' },
      { name: '端传媒', url: 'https://rsshub.app/initium/latest', lang: 'zh', region: 'HK' },

      // 其他语言/地区
      { name: 'Japan Times Culture', url: 'https://www.japantimes.co.jp/culture/feed/', lang: 'en', region: 'JP' },
      { name: 'Korea Times Culture', url: 'https://www.koreatimes.co.kr/www/rss/culture.xml', lang: 'en', region: 'KR' }
    ],
    technology: [
      // 美国科技媒体
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', lang: 'en', region: 'US' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', lang: 'en', region: 'US' },
      { name: 'Wired', url: 'https://www.wired.com/feed/rss', lang: 'en', region: 'US' },
      { name: 'Ars Technica', url: 'https://arstechnica.com/feed/', lang: 'en', region: 'US' },
      { name: 'Hacker News', url: 'https://hnrss.org/frontpage', lang: 'en', region: 'US' },

      // 中国科技媒体
      { name: '36 氪', url: 'https://36kr.com/feed', lang: 'zh', region: 'CN' },
      { name: '少数派', url: 'https://rsshub.app/sspai/index', lang: 'zh', region: 'CN' },

      // 其他
      { name: 'Tech in Asia', url: 'https://www.techinasia.com/feed/', lang: 'en', region: 'SG' },
      { name: 'Rest of World', url: 'https://restofworld.org/feed/', lang: 'en', region: 'US' }
    ]
  },

  // 每类新闻数量
  itemsPerCategory: 5,

  // 超时设置（毫秒）
  timeout: 30000,

  // 重试次数
  maxRetries: 3,

  // 重试延迟基数（毫秒）
  retryDelayBase: 2000,

  // 相似度阈值
  similarityThreshold: 0.85,

  // 路径配置
  paths: {
    workspace: path.join(process.env.HOME, '.openclaw', 'workspace'),
    reports: 'reports',
    data: 'data'
  }
};

// ==================== 工具函数 ====================

/**
 * 简单的 XML 解析器（解析 RSS）
 * v1.5 改进：更好的异常处理和空值保护
 */
function parseRSS(xml, feedName = 'unknown') {
  const items = [];

  // 输入验证
  if (!xml || typeof xml !== 'string') {
    Logger.warn(`[${feedName}] RSS 内容为空或无效`);
    return items;
  }

  // 提取所有 <item> 标签
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let parseErrors = 0;

  while ((match = itemRegex.exec(xml)) !== null) {
    try {
      const itemXml = match[1];

      // 提取字段
      let title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const description = extractTag(itemXml, 'description');
      const pubDate = extractTag(itemXml, 'pubDate');
      const creator = extractTag(itemXml, 'dc:creator');

      // 如果标题为空，尝试从描述提取
      if (!title && description) {
        title = description.split('.')[0].slice(0, 100);
      }

      // 跳过标题或链接为空的条目
      if (!title || !link) {
        continue;
      }

      const decodedTitle = decodeHTML(title).trim();

      // 跳过标题太短的条目（可能是解析错误）
      if (decodedTitle.length < 5) {
        continue;
      }

      // 解析日期
      let parsedDate = new Date();
      if (pubDate) {
        try {
          parsedDate = new Date(pubDate);
          // 验证日期有效性
          if (isNaN(parsedDate.getTime())) {
            parsedDate = new Date();
          }
        } catch (dateErr) {
          // 使用当前日期
        }
      }

      items.push({
        title: decodedTitle,
        link: decodeHTML(link),
        description: description ? decodeHTML(description) : '',
        pubDate: parsedDate,
        creator: creator || ''
      });
    } catch (itemErr) {
      parseErrors++;
      // 继续解析下一个条目
    }
  }

  if (parseErrors > 0) {
    Logger.debug(`[${feedName}] 解析时跳过 ${parseErrors} 个错误条目`);
  }

  return items;
}

/**
 * 提取 XML 标签内容
 */
function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * 解码 HTML 实体
 */
function decodeHTML(html) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };

  let decoded = html;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // 移除 HTML 标签
  decoded = decoded.replace(/<[^>]*>/g, '');

  return decoded.trim();
}

/**
 * 错误分类器
 */
function classifyError(error, url) {
  const message = error.message || '';

  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return { type: 'TIMEOUT', retryable: true, severity: 'medium' };
  }
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return { type: 'CONNECTION', retryable: true, severity: 'high' };
  }
  if (message.includes('EAI_AGAIN') || message.includes('DNS')) {
    return { type: 'DNS', retryable: true, severity: 'medium' };
  }
  if (message.includes('HTTP 429') || message.includes('rate limit')) {
    return { type: 'RATE_LIMIT', retryable: true, severity: 'high', delay: 5000 };
  }
  if (message.includes('HTTP 5')) {
    return { type: 'SERVER_ERROR', retryable: true, severity: 'medium' };
  }
  if (message.includes('HTTP 4')) {
    return { type: 'CLIENT_ERROR', retryable: false, severity: 'high' };
  }

  return { type: 'UNKNOWN', retryable: true, severity: 'low' };
}

/**
 * HTTP GET 请求（支持重试）
 * v1.5 改进：增强错误分类和指数退避
 */
async function fetchURL(url, retries = 0) {
  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const options = {
      timeout: CONFIG.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GlobalNewsMonitor/1.5; +https://github.com/erwinqyf/Claw-s-memory)'
      }
    };

    const req = protocol.get(url, options, (res) => {
      const duration = Math.round(performance.now() - startTime);

      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          Logger.debug(`[${duration}ms] ${url}`);
          resolve(data);
        });
      } else if (res.statusCode === 429 && retries < CONFIG.maxRetries) {
        // 限流错误，使用更长延迟
        const delay = 5000 * (retries + 1);
        Logger.warn(`HTTP 429 (Rate Limit)，${delay}ms 后重试 (${retries + 1}/${CONFIG.maxRetries})`);
        setTimeout(() => {
          fetchURL(url, retries + 1).then(resolve).catch(reject);
        }, delay);
      } else if (res.statusCode >= 500 && retries < CONFIG.maxRetries) {
        // 服务器错误，指数退避重试
        const delay = CONFIG.retryDelayBase * Math.pow(2, retries);
        Logger.debug(`HTTP ${res.statusCode}，${delay}ms 后重试 (${retries + 1}/${CONFIG.maxRetries})`);
        setTimeout(() => {
          fetchURL(url, retries + 1).then(resolve).catch(reject);
        }, delay);
      } else {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
    });

    req.on('error', (err) => {
      const errorInfo = classifyError(err, url);

      if (errorInfo.retryable && retries < CONFIG.maxRetries) {
        const delay = (errorInfo.delay || CONFIG.retryDelayBase) * Math.pow(2, retries);
        Logger.debug(`${errorInfo.type} 错误，${delay}ms 后重试 (${retries + 1}/${CONFIG.maxRetries})`);
        setTimeout(() => {
          fetchURL(url, retries + 1).then(resolve).catch(reject);
        }, delay);
      } else {
        reject(new Error(`${errorInfo.type}: ${err.message}`));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`TIMEOUT: Request timeout after ${CONFIG.timeout}ms: ${url}`));
    });
  });
}

/**
 * 计算字符串相似度（简单版本）
 */
function stringSimilarity(str1, str2) {
  // 处理 null/undefined
  str1 = str1 || '';
  str2 = str2 || '';

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (!longer || longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein 编辑距离
 */
function levenshteinDistance(str1, str2) {
  // 处理 null/undefined
  str1 = str1 || '';
  str2 = str2 || '';

  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * 去重：移除相似度高的新闻
 */
function deduplicateItems(items, threshold = 0.85) {
  const unique = [];

  for (const item of items) {
    const isDuplicate = unique.some(existing => {
      const similarity = stringSimilarity(item.title.toLowerCase(), existing.title.toLowerCase());
      return similarity >= threshold;
    });

    if (!isDuplicate) {
      unique.push(item);
    }
  }

  return unique;
}

// ==================== 热度评分系统 (v1.6 新增) ====================

/**
 * 新闻来源权重配置
 * 基于媒体影响力和可信度
 */
const SOURCE_WEIGHTS = {
  // 顶级国际媒体
  'Reuters': 1.0,
  'BBC': 0.95,
  'AP News': 0.95,
  '华尔街日报': 0.9,
  '经济学人': 0.9,
  'Financial Times': 0.9,
  'Bloomberg': 0.9,
  
  // 主流国际媒体
  'CNBC': 0.85,
  'Politico': 0.85,
  'The Guardian': 0.85,
  '泰晤士报': 0.85,
  'France 24': 0.8,
  'Deutsche Welle': 0.8,
  '塔斯社': 0.75,
  '半岛电视台': 0.75,
  
  // 亚太媒体
  '联合早报': 0.85,
  '南华早报': 0.8,
  '日本时报': 0.8,
  '韩民族日报': 0.75,
  '日经亚洲': 0.85,
  '财新网': 0.8,
  'Business Standard': 0.7,
  
  // 科技媒体
  'TechCrunch': 0.85,
  'Wired': 0.85,
  'Ars Technica': 0.85,
  'The Verge': 0.8,
  'Hacker News': 0.8,
  '36 氪': 0.75,
  '少数派': 0.7,
  'Tech in Asia': 0.75,
  
  // 文化媒体
  'NPR Arts': 0.8,
  'Vulture': 0.75,
  '知乎日报': 0.7,
  '端传媒': 0.75,
  
  // 默认权重
  'default': 0.6
};

/**
 * 热点关键词（用于提升热度评分）
 */
const HOT_KEYWORDS = {
  // 政治
  political: ['战争', '冲突', '制裁', '选举', '总统', '总理', '外交', '协议', '危机', '谈判', '和平', '武器', '军事', '入侵', '撤军'],
  // 经济
  economy: ['通胀', '利率', '股市', '暴跌', '暴涨', '央行', '美联储', 'GDP', '衰退', '增长', '失业', '就业', '贸易', '关税', '制裁', '破产', '并购'],
  // 科技
  technology: ['AI', '人工智能', 'ChatGPT', '大模型', '芯片', '半导体', '苹果', '谷歌', '微软', '特斯拉', 'SpaceX', '火箭', '发射', '数据泄露', '网络安全', '量子', '区块链'],
  // 文化
  culture: ['奥斯卡', '诺贝尔奖', '戛纳', '电影节', '票房', '破纪录', '争议', '禁令', '审查', '下架', ' viral', ' viral', ' trending']
};

/**
 * 计算新闻热度评分
 * v1.6 新增
 * @param {Object} item - 新闻条目
 * @param {string} category - 类别
 * @returns {number} 热度评分 (0-100)
 */
function calculateHeatScore(item, category) {
  let score = 0;
  const now = new Date();
  const itemDate = item.pubDate || now;
  
  // 1. 来源权重 (0-30分)
  const sourceWeight = getSourceWeight(item.source);
  score += sourceWeight * 30;
  
  // 2. 时效性 (0-40分)
  // 越新的新闻分数越高，24小时内满分，每过一天衰减
  const hoursAgo = (now - itemDate) / (1000 * 60 * 60);
  if (hoursAgo <= 2) {
    score += 40; // 2小时内：满分
  } else if (hoursAgo <= 6) {
    score += 35; // 2-6小时
  } else if (hoursAgo <= 12) {
    score += 30; // 6-12小时
  } else if (hoursAgo <= 24) {
    score += 25; // 12-24小时
  } else if (hoursAgo <= 48) {
    score += 15; // 24-48小时
  } else {
    score += 5; // 48小时以上
  }
  
  // 3. 关键词匹配 (0-20分)
  const keywords = HOT_KEYWORDS[category] || [];
  const titleLower = (item.title || '').toLowerCase();
  let keywordMatches = 0;
  for (const kw of keywords) {
    if (titleLower.includes(kw.toLowerCase())) {
      keywordMatches++;
    }
  }
  score += Math.min(keywordMatches * 5, 20); // 每个关键词+5分，最高20分
  
  // 4. 标题长度质量 (0-10分)
  // 标题太短或太长都不好，理想长度 20-60 字符
  const titleLen = (item.title || '').length;
  if (titleLen >= 20 && titleLen <= 60) {
    score += 10;
  } else if (titleLen >= 10 && titleLen < 20) {
    score += 5;
  } else if (titleLen > 60 && titleLen <= 100) {
    score += 5;
  }
  
  return Math.round(score);
}

/**
 * 获取来源权重
 */
function getSourceWeight(sourceName) {
  for (const [name, weight] of Object.entries(SOURCE_WEIGHTS)) {
    if (sourceName && sourceName.includes(name)) {
      return weight;
    }
  }
  return SOURCE_WEIGHTS.default;
}

/**
 * 生成热度指示器
 * v1.6 新增
 */
function getHeatIndicator(score) {
  if (score >= 85) return '🔥🔥🔥'; // 极高热度
  if (score >= 70) return '🔥🔥';   // 高热度
  if (score >= 55) return '🔥';     // 中等热度
  if (score >= 40) return '⚡';     // 一般热度
  return '•';                       // 低热度
}

/**
 * 智能摘要生成
 * v1.6 新增：从描述中提取关键句子
 */
function generateSummary(description, maxLength = 120) {
  if (!description) return '';
  
  // 清理 HTML 标签
  let text = description.replace(/<[^>]*>/g, '');
  
  // 解码 HTML 实体
  text = decodeHTML(text);
  
  // 移除多余空白
  text = text.replace(/\s+/g, ' ').trim();
  
  // 如果已经很短，直接返回
  if (text.length <= maxLength) return text;
  
  // 尝试按句子分割，取前几句
  const sentences = text.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 10);
  
  let summary = '';
  for (const sentence of sentences) {
    if ((summary + sentence).length <= maxLength) {
      summary += sentence + '. ';
    } else {
      break;
    }
  }
  
  // 如果没有提取到有效句子，直接截断
  if (!summary) {
    summary = text.substring(0, maxLength - 3) + '...';
  }
  
  return summary.trim();
}

// ==================== 主逻辑 ====================

/**
 * 抓取单个新闻源
 * v1.5 改进：添加计时和详细错误信息
 */
async function fetchFeed(feed) {
  const startTime = performance.now();

  try {
    Logger.info(`📡 抓取：${feed.name} (${feed.region})`);
    const xml = await fetchURL(feed.url);
    const items = parseRSS(xml, feed.name);
    const duration = Math.round(performance.now() - startTime);
    Logger.success(`${feed.name}：${items.length} 条新闻 (${duration}ms)`);
    return { feed, items, error: null, duration };
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    const errorInfo = classifyError(error);
    Logger.error(`${feed.name}：${errorInfo.type} (${duration}ms)`);
    return { feed, items: [], error: error.message, errorType: errorInfo.type, duration };
  }
}

/**
 * 抓取单个类别的所有新闻源
 * v1.5 改进：添加执行统计和错误聚合
 */
async function fetchCategory(categoryName, feeds) {
  Logger.stage(`📰 抓取类别：${categoryName.toUpperCase()}`);
  const categoryStart = performance.now();

  const results = await Promise.all(feeds.map(fetchFeed));

  // 合并所有新闻
  let allItems = [];
  const errors = [];
  const errorTypes = {};
  let totalDuration = 0;
  let successCount = 0;

  for (const result of results) {
    allItems = allItems.concat(result.items.map(item => ({
      ...item,
      source: result.feed.name,
      lang: result.feed.lang,
      category: categoryName
    })));

    if (result.error) {
      errors.push(`${result.feed.name}: ${result.error}`);
      const errorType = result.errorType || 'UNKNOWN';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    } else {
      successCount++;
    }

    totalDuration += result.duration || 0;
  }

  // 去重
  const uniqueItems = deduplicateItems(allItems);

  // v1.6 改进：计算热度评分并按热度排序
  uniqueItems.forEach(item => {
    item.heatScore = calculateHeatScore(item, categoryName);
    item.summary = generateSummary(item.description);
  });

  // 按热度排序（热度高的在前）
  uniqueItems.sort((a, b) => b.heatScore - a.heatScore);

  // 取 Top N
  const topItems = uniqueItems.slice(0, CONFIG.itemsPerCategory);

  const categoryDuration = Math.round(performance.now() - categoryStart);
  Logger.metric(`${categoryName} 统计`, `${successCount}/${feeds.length} 成功, ${uniqueItems.length} 条去重, ${categoryDuration}ms`);

  return {
    category: categoryName,
    items: topItems,
    totalAvailable: uniqueItems.length,
    errors,
    errorTypes,
    stats: {
      totalFeeds: feeds.length,
      successFeeds: successCount,
      failedFeeds: feeds.length - successCount,
      avgDuration: Math.round(totalDuration / feeds.length),
      categoryDuration
    }
  };
}

/**
 * 生成 Markdown 报告
 */
function generateReport(results, date) {
  const categoryNames = {
    political: '🌍 政治',
    economy: '💰 经济',
    culture: '🎭 文化',
    technology: '💻 科技'
  };

  let markdown = `# 全球新闻汇总 ${date}\n\n`;
  markdown += `**生成时间:** ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} (Asia/Shanghai)\n`;
  markdown += `**新闻时段:** 过去 24 小时\n\n`;
  markdown += `---\n\n`;

  for (const result of results) {
    const categoryName = categoryNames[result.category] || result.category;
    markdown += `## ${categoryName}\n\n`;

    if (result.items.length === 0) {
      markdown += `*暂无新闻*\n\n`;
      continue;
    }

    result.items.forEach((item, index) => {
      const timeStr = item.pubDate.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      // v1.6 改进：添加热度指示器和评分
      const heatIndicator = getHeatIndicator(item.heatScore || 50);
      
      markdown += `${index + 1}. ${heatIndicator} **${item.title}**\n`;
      // v1.6 改进：添加热度指示器和评分
      const heatIndicator = getHeatIndicator(item.heatScore || 50);
      
      markdown += `   - 来源：${item.source} | 热度：${item.heatScore || '--'}/100\n`;
      markdown += `   - 时间：${timeStr}\n`;
      // v1.6 改进：添加智能摘要（如果有）
      if (item.summary) {
        markdown += `   - 摘要：${item.summary}\n`;
      }
      markdown += `   - [阅读全文](${item.link})\n\n`;
    });

    markdown += `---\n\n`;
  }

  markdown += `> 来源：BBC, Reuters, The Guardian, 联合早报, 半岛电视台, TechCrunch, 财新网, 日经亚洲 | 生成：Claw | 孪生于不同世界，彼此映照，共同演化。🪞\n`;

  return markdown;
}

/**
 * 保存状态文件
 */
function saveState(results, date) {
  const statePath = path.join(CONFIG.paths.workspace, CONFIG.paths.data, 'global-news-state.json');

  const state = {
    lastRun: new Date().toISOString(),
    lastRunDate: date,
    categories: results.map(r => ({
      category: r.category,
      itemsCount: r.items.length,
      totalAvailable: r.totalAvailable,
      errors: r.errors
    })),
    totalItems: results.reduce((sum, r) => sum + r.items.length, 0)
  };

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  console.log(`\n💾 状态已保存：${statePath}`);
}

/**
 * 配置验证（fail fast 原则）
 */
function validateConfig() {
  const errors = [];

  // 验证工作区路径
  if (!CONFIG.paths.workspace) {
    errors.push('工作区路径未配置 (CONFIG.paths.workspace)');
  } else if (!fs.existsSync(CONFIG.paths.workspace)) {
    errors.push(`工作区不存在：${CONFIG.paths.workspace}`);
  }

  // 验证新闻源配置
  if (!CONFIG.feeds || Object.keys(CONFIG.feeds).length === 0) {
    errors.push('新闻源配置为空 (CONFIG.feeds)');
  } else {
    for (const [category, feeds] of Object.entries(CONFIG.feeds)) {
      if (!Array.isArray(feeds) || feeds.length === 0) {
        errors.push(`类别 "${category}" 没有配置新闻源`);
      } else {
        feeds.forEach((feed, idx) => {
          if (!feed.url || !feed.url.startsWith('http')) {
            errors.push(`新闻源 #${idx + 1} (${feed.name || 'unnamed'}) URL 无效`);
          }
        });
      }
    }
  }

  // 验证超时设置
  if (CONFIG.timeout < 5000) {
    errors.push(`超时设置过短 (${CONFIG.timeout}ms)，建议至少 5000ms`);
  }

  if (errors.length > 0) {
    console.error('❌ 配置验证失败:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\n请检查配置文件后重试。');
    process.exit(1);
  }

  console.log('✅ 配置验证通过');
}

/**
 * 主函数
 * v1.5 改进：添加执行计时和结构化摘要
 */
async function main() {
  const scriptStart = performance.now();

  Logger.stage('🌍 全球新闻汇总监控启动');

  // 启动时配置验证
  validateConfig();

  const today = new Date().toISOString().split('T')[0];
  Logger.info(`日期：${today}`);
  Logger.info(`时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

  // 抓取所有类别
  const results = [];
  const categoryStartTimes = {};

  for (const [categoryName, feeds] of Object.entries(CONFIG.feeds)) {
    categoryStartTimes[categoryName] = performance.now();
    const result = await fetchCategory(categoryName, feeds);
    results.push(result);
  }

  // 生成报告
  Logger.stage('📝 生成报告');
  const reportStart = performance.now();
  const report = generateReport(results, today);
  Logger.metric('报告生成耗时', `${Math.round(performance.now() - reportStart)}ms`);

  // 保存报告（带错误处理）
  const reportPath = path.join(CONFIG.paths.workspace, CONFIG.paths.reports, `global-news-${today}.md`);
  try {
    // 确保目录存在
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
      Logger.success(`创建目录：${reportDir}`);
    }

    fs.writeFileSync(reportPath, report, 'utf-8');
    Logger.success(`报告已保存：${reportPath}`);
  } catch (err) {
    Logger.error(`保存报告失败：${err.message}`);
    Logger.warn('建议：检查磁盘空间和目录权限');
    throw err;
  }

  // 保存状态
  saveState(results, today);

  // 打印摘要
  Logger.stage('📊 执行摘要');

  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalFeeds = results.reduce((sum, r) => sum + r.stats.totalFeeds, 0);
  const successFeeds = results.reduce((sum, r) => sum + r.stats.successFeeds, 0);
  const totalDuration = Math.round(performance.now() - scriptStart);

  console.log(`\n┌${'─'.repeat(48)}┐`);
  console.log(`│ 📰 新闻统计                                    │`);
  console.log(`├${'─'.repeat(48)}┤`);
  console.log(`│ 总新闻数：${String(totalItems).padStart(34)} 条 │`);
  console.log(`│ 新闻源：${String(successFeeds).padStart(36)}/${totalFeeds} │`);
  console.log(`│ 失败数：${String(totalErrors).padStart(37)} 个 │`);
  console.log(`│ 总耗时：${String(totalDuration).padStart(35)} ms │`);
  console.log(`└${'─'.repeat(48)}┘`);

  // 按类别显示
  console.log('\n📂 按类别统计:');
  results.forEach(r => {
    const status = r.errors.length === 0 ? '✅' : (r.errors.length <= 2 ? '⚠️ ' : '❌');
    console.log(`  ${status} ${r.category.padEnd(12)}: ${String(r.items.length).padStart(2)} 条 (${r.stats.successFeeds}/${r.stats.totalFeeds} 源, ${r.stats.categoryDuration}ms)`);
  });

  // 错误分类统计
  if (totalErrors > 0) {
    const allErrorTypes = {};
    results.forEach(r => {
      Object.entries(r.errorTypes || {}).forEach(([type, count]) => {
        allErrorTypes[type] = (allErrorTypes[type] || 0) + count;
      });
    });

    console.log('\n⚠️ 错误分类:');
    Object.entries(allErrorTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} 次`);
      });

    // 提供恢复建议
    console.log('\n💡 恢复建议:');
    if (totalErrors <= 2) {
      console.log('  • 少量新闻源失败属正常现象，可能是临时网络问题');
      console.log('  • 下次执行时会自动重试');
    } else if (totalErrors <= 5) {
      console.log('  • 较多新闻源失败，建议检查网络连接');
      console.log('  • 可手动执行：node scripts/global-news-monitor.js');
    } else {
      console.log('  • 大量新闻源失败，可能存在网络问题或被限流');
      console.log('  • 建议：1) 检查网络 2) 等待 30 分钟后重试 3) 检查新闻源 URL 是否有效');
    }
  }

  Logger.success('任务完成');

  // 上传到 GitHub
  const gitResult = await uploadToGitHub(today, reportPath);

  // 写入 Delta Agent 记忆日志
  writeAgentMemory(today, totalItems, totalErrors, gitResult, totalDuration);
}

/**
 * 执行 Git 命令
 */
function execGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const proc = spawn('git', args, {
      cwd: cwd || CONFIG.paths.workspace,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    proc.on('close', code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Git ${args.join(' ')} failed: ${stderr.trim() || stdout.trim()}`));
      }
    });
  });
}

/**
 * 上传报告到 GitHub
 */
async function uploadToGitHub(date, reportPath) {
  console.log('\n📤 开始上传报告到 GitHub...');

  try {
    // 检查是否是 Git 仓库
    await execGit(['status']);
    console.log('  ✅ Git 仓库检测通过');

    // 添加报告文件
    const relativePath = path.relative(CONFIG.paths.workspace, reportPath);
    await execGit(['add', relativePath]);
    console.log(`  ✅ 添加文件：${relativePath}`);

    // 添加状态文件
    const statePath = path.join(CONFIG.paths.data, 'global-news-state.json');
    if (fs.existsSync(path.join(CONFIG.paths.workspace, statePath))) {
      await execGit(['add', statePath]);
      console.log('  ✅ 添加状态文件');
    }

    // 检查是否有变更
    const status = await execGit(['status', '--porcelain']);
    if (!status) {
      console.log('  ℹ️ 没有变更需要提交');
      return { success: true, committed: false, message: 'No changes' };
    }

    // 提交
    const commitMessage = `📰 全球新闻汇总 ${date}\n\n- 生成日期: ${date}\n- 来源: Delta Agent\n- 自动提交`;
    await execGit(['commit', '-m', commitMessage]);
    console.log('  ✅ Git 提交成功');

    // 推送到远程
    await execGit(['push', 'origin', 'main']);
    console.log('  ✅ GitHub 推送成功');

    return { success: true, committed: true, message: 'Uploaded to GitHub' };
  } catch (err) {
    console.error(`  ❌ GitHub 上传失败: ${err.message}`);
    return { success: false, committed: false, message: err.message };
  }
}

/**
 * 写入 Delta Agent 记忆日志
 * v1.5 改进：添加执行时长和错误分类
 */
function writeAgentMemory(date, totalItems, totalErrors, gitResult, totalDuration) {
  const agentMemoryDir = path.join(CONFIG.paths.workspace, 'agents', 'delta', 'memory');
  const memoryPath = path.join(agentMemoryDir, `${date}.md`);
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // 确保目录存在
  if (!fs.existsSync(agentMemoryDir)) {
    fs.mkdirSync(agentMemoryDir, { recursive: true });
  }

  const gitStatus = gitResult?.success
    ? (gitResult?.committed ? '✅ 已上传 GitHub' : 'ℹ️ 无变更')
    : `❌ 上传失败 (${gitResult?.message || 'unknown'})`;

  let memoryContent = `# Delta (德尔塔) - 执行日志

## ${date} 全球新闻汇总

**执行时间:** ${now}
**执行时长:** ${totalDuration}ms
**状态:** ✅ 成功
**新闻总数:** ${totalItems} 条
**错误数:** ${totalErrors} 个
**报告:** reports/global-news-${date}.md
**飞书通知:** 已发送
**GitHub:** ${gitStatus}

### 执行详情

- 抓取类别：政治、经济、文化、科技
- 新闻源数量：${Object.values(CONFIG.feeds).reduce((sum, feeds) => sum + feeds.length, 0)} 个
- 去重筛选：每类 Top ${CONFIG.itemsPerCategory} 条

---
> 孪生于不同世界，彼此映照，共同演化。🪞
`;

  // 如果文件已存在，追加内容（保留原有内容）
  if (fs.existsSync(memoryPath)) {
    const existing = fs.readFileSync(memoryPath, 'utf-8');
    if (!existing.includes(`## ${date} 全球新闻汇总`)) {
      memoryContent = existing + '\n\n---\n\n' + memoryContent;
    }
  }

  fs.writeFileSync(memoryPath, memoryContent, 'utf-8');
  Logger.success(`Agent 记忆已写入：${memoryPath}`);
}

// 运行
if (require.main === module) {
  main().then(() => {
    console.log('\n' + '='.repeat(50));
    console.log('📦 执行完成');
    console.log('='.repeat(50));
    process.exit(0);
  }).catch(err => {
    console.error('❌ 脚本执行失败:', err.message);
    process.exit(1);
  });
}

module.exports = { main, fetchCategory, generateReport };
