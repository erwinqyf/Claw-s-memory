# 封面图生成状态

## 问题说明

尝试使用 nano-banana-pro (Gemini 3 Pro Image) 生成封面图时遇到以下问题:

1. **缺少有效的 GEMINI_API_KEY** - 当前配置的 API key 是 Bailian (通义千问) 的 key，不适用于 Gemini API
2. **替代方案尝试失败**:
   - OpenAI Image Gen: API key 不兼容
   - DashScope Wanx2.1: API key 验证失败

## 解决方案

需要以下任一条件才能继续生成封面图:

### 方案 1: 配置 Gemini API Key
1. 获取 Gemini API key: https://aistudio.google.com/app/apikey
2. 添加到 `~/.openclaw/openclaw.json`:
```json
{
  "skills": {
    "nano-banana-pro": {
      "apiKey": "YOUR_GEMINI_API_KEY_HERE"
    }
  }
}
```

### 方案 2: 使用其他图像生成工具
- 手动使用 Canva/稿定设计按照设计方案制作
- 使用其他已配置的图像生成 API

## 设计方案参考

详见 `/home/admin/.openclaw/workspace/output/xiaohongshu/04-final-ready.md` 中的「封面设计方案」部分

### 方案 A (对比图)
- 左右分割对比图
- 左侧：绿色上升箭头 +18% + 微笑表情
- 右侧：红色下降箭头 -12% + 沮丧表情
- 中间：AI 机器人图标
- 背景：深灰渐变

### 方案 B (极简风)
- 单一 AI 机器人手持翻译文档
- 背景：纯黑
- 文字：霓虹蓝 + 荧光绿

### 方案 C (数据图表风)
- 柱状图对比
- 背景：白色渐变浅灰
- 图表：蓝绿渐变 vs 红橙渐变
