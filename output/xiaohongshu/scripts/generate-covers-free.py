#!/usr/bin/env python3
"""
小红书封面图生成器 - 免费免 API Key 版本
使用 Pollinations.ai (完全免费，无需注册)
"""

import os
import requests
from datetime import datetime

OUTPUT_DIR = "/home/admin/.openclaw/workspace/output/xiaohongshu/covers"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Pollinations.ai API (免费，无需 key)
# 文档：https://pollinations.ai/
BASE_URL = "https://image.pollinations.ai/prompt/"

# 3 个封面设计方案（英文提示词）
prompts = {
    "cover-a": {
        "name": "版本 A - 对比图",
        "prompt": "professional social media cover vertical 3:4 ratio, left side green upward arrow +18 percent smiling emoji, right side red downward arrow -12 percent sad emoji, center AI robot icon divider, dark gray gradient background, top bold text AI translation productivity plus 40 percent, bottom text will not use equals less earn 12 percent, tech blue and warning orange accent colors, clean modern data visualization style, high quality",
        "width": 1242,
        "height": 1660
    },
    "cover-b": {
        "name": "版本 B - 极简风",
        "prompt": "minimalist social media cover vertical 3:4 ratio, single AI robot holding translation documents, radiant light beams background, pure black background, top neon blue text AI translation productivity, center giant plus 40 percent neon blue and fluorescent green gradient, bottom modern sans serif will not use equals less earn 12 percent, cyberpunk aesthetic clean bold, high quality",
        "width": 1242,
        "height": 1660
    },
    "cover-c": {
        "name": "版本 C - 数据图表风",
        "prompt": "data chart style social media cover vertical 3:4 ratio, bar chart comparison left tall bar 18 percent blue green gradient, right short bar -12 percent red orange gradient, white to light gray gradient background, top text 2025 translator income report, above chart question will you use AI question mark, bottom text start learning now not late, professional business chart style clean typography modern corporate aesthetic, high quality",
        "width": 1242,
        "height": 1660
    }
}

def generate_image(name, config):
    """调用 Pollinations.ai API 生成图片"""
    print(f"\n🎨 正在生成 {config['name']}...")
    
    # 构建 URL
    url = f"{BASE_URL}{config['prompt']}?width={config['width']}&height={config['height']}&nologo=true"
    
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        # 保存图片
        filename = f"{name}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"   ✅ 保存成功：{filepath}")
        print(f"   📐 尺寸：{config['width']}x{config['height']}")
        return filepath
        
    except Exception as e:
        print(f"   ❌ 生成失败：{e}")
        return None

def main():
    print("=" * 60)
    print("🎨 小红书封面图生成器 - 免费免 API Key 版")
    print("使用：Pollinations.ai (完全免费)")
    print("=" * 60)
    
    results = {}
    
    for name, config in prompts.items():
        filepath = generate_image(name, config)
        results[name] = filepath
    
    # 生成结果报告
    report = generate_report(results)
    print(f"\n📊 生成报告已保存：{report}")
    
    print("\n" + "=" * 60)
    print("✅ 所有封面图生成完成！")
    print("=" * 60)

def generate_report(results):
    """生成结果报告"""
    report_path = os.path.join(OUTPUT_DIR, "pollinations-results.md")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# 小红书封面图生成结果\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("**工具**: Pollinations.ai (免费免 API Key)\n\n")
        
        f.write("## 生成结果\n\n")
        for name, filepath in results.items():
            if filepath:
                f.write(f"### ✅ {name}\n")
                f.write(f"- 文件：`{filepath}`\n")
                f.write(f"- 状态：生成成功\n\n")
            else:
                f.write(f"### ❌ {name}\n")
                f.write(f"- 状态：生成失败\n\n")
        
        f.write("## 使用说明\n\n")
        f.write("1. 查看生成的封面图\n")
        f.write("2. 选择最喜欢的版本\n")
        f.write("3. 复制文案和标签到小红书发布\n\n")
    
    return report_path

if __name__ == "__main__":
    main()
