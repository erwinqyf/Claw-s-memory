#!/usr/bin/env python3
"""
小红书封面图生成器 - Hugging Face 免费版本
使用 Stability AI 的 Stable Diffusion 模型
"""

import os
import requests
import time
from datetime import datetime

OUTPUT_DIR = "/home/admin/.openclaw/workspace/output/xiaohongshu/covers"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Hugging Face Inference API (免费额度)
# 使用 Stability AI 的模型
API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"

# 3 个封面设计方案（英文提示词，更简洁）
prompts = {
    "cover-a": {
        "name": "版本 A - 对比图",
        "prompt": "professional social media cover, vertical format, split screen comparison, left green up arrow +18 percent happy, right red down arrow -12 percent sad, AI robot in center, dark gradient background, bold text AI productivity plus 40 percent, modern data visualization, high quality, 4k",
        "negative": "blurry, low quality, distorted text, ugly"
    },
    "cover-b": {
        "name": "版本 B - 极简风",
        "prompt": "minimalist social media cover, vertical format, AI robot with documents, black background, neon blue and green glow, large text plus 40 percent center, cyberpunk style, clean bold design, high quality, 4k",
        "negative": "cluttered, busy, low quality, distorted"
    },
    "cover-c": {
        "name": "版本 C - 数据图表风",
        "prompt": "business chart social media cover, vertical format, bar chart comparison 18 percent vs -12 percent, blue green and red orange gradient, white background, professional typography, clean modern corporate style, high quality, 4k",
        "negative": "messy, ugly, low quality, distorted text"
    }
}

def generate_image(name, config):
    """调用 Hugging Face API 生成图片"""
    print(f"\n🎨 正在生成 {config['name']}...")
    
    headers = {}  # 免费额度无需 key（有速率限制）
    
    payload = {
        "inputs": config["prompt"],
        "parameters": {
            "negative_prompt": config["negative"],
            "width": 768,
            "height": 1024,  # 接近 3:4 比例
            "num_inference_steps": 30
        }
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
        
        # 检查是否需要等待模型加载
        if response.status_code == 503:
            print(f"   ⏳ 模型加载中，等待 30 秒...")
            time.sleep(30)
            response = requests.post(API_URL, headers=headers, json=payload, timeout=120)
        
        response.raise_for_status()
        
        # 保存图片
        filename = f"{name}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"   ✅ 保存成功：{filepath}")
        print(f"   📐 尺寸：768x1024 (可后期裁剪到 3:4)")
        return filepath
        
    except requests.exceptions.HTTPError as e:
        if response.status_code == 429:
            print(f"   ⚠️ 速率限制，请稍后重试")
        else:
            print(f"   ❌ HTTP 错误：{e}")
        return None
    except Exception as e:
        print(f"   ❌ 生成失败：{e}")
        return None

def main():
    print("=" * 60)
    print("🎨 小红书封面图生成器 - Hugging Face 免费版")
    print("使用：Stable Diffusion XL (免费额度)")
    print("=" * 60)
    
    results = {}
    
    for name, config in prompts.items():
        filepath = generate_image(name, config)
        results[name] = filepath
        
        # 避免触发速率限制，每个请求间隔 5 秒
        if filepath:
            time.sleep(5)
    
    # 生成结果报告
    report = generate_report(results)
    print(f"\n📊 生成报告已保存：{report}")
    
    print("\n" + "=" * 60)
    print("✅ 所有封面图生成完成！")
    print("=" * 60)

def generate_report(results):
    """生成结果报告"""
    report_path = os.path.join(OUTPUT_DIR, "hf-results.md")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# 小红书封面图生成结果\n\n")
        f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("**工具**: Hugging Face Inference API (Stable Diffusion XL)\n")
        f.write("**免费额度**: 无需 API Key，有速率限制\n\n")
        
        f.write("## 生成结果\n\n")
        for name, filepath in results.items():
            if filepath:
                f.write(f"### ✅ {name}\n")
                f.write(f"- 文件：`{filepath}`\n")
                f.write(f"- 状态：生成成功\n")
                f.write(f"- 尺寸：768x1024 (可裁剪到 1242x1660)\n\n")
            else:
                f.write(f"### ❌ {name}\n")
                f.write(f"- 状态：生成失败\n\n")
        
        f.write("## 后续处理建议\n\n")
        f.write("1. 使用图片编辑工具裁剪/调整到 1242x1660 (3:4 比例)\n")
        f.write("2. 添加文字 overlay（如果需要）\n")
        f.write("3. 选择最佳版本发布\n\n")
    
    return report_path

if __name__ == "__main__":
    main()
