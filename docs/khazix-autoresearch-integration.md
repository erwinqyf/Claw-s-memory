# Khazix Skills × AutoResearchClaw 结合方案

> 将卡兹克的横纵分析法与AutoResearchClaw的自动化科研流水线结合

---

## 1. 两个项目的核心能力

### Khazix Skills（横纵分析法）
- **定位**：产品/公司/概念/人物的深度研究方法论
- **核心**：历时-共时双轴分析框架
- **输出**：排版精美的PDF研究报告（1-3万字）
- **特色**：学术溯源 + 叙事驱动 + 文化升维

### AutoResearchClaw
- **定位**：全自动AI科研流水线
- **核心**：8大阶段、23个子阶段的多智能体协作
- **输出**：符合学术会议标准的论文（LaTeX + 实验代码）
- **特色**：文献验证 + 实验执行 + 自我迭代

---

## 2. 结合点分析

### 互补性

| 维度 | Khazix Skills | AutoResearchClaw | 结合价值 |
|------|---------------|------------------|----------|
| **研究对象** | 产品/公司/概念/人物 | 学术问题/技术假设 | 扩展研究范围 |
| **输出形式** | 叙事型研究报告 | 学术论文 | 双轨输出 |
| **方法论** | 人文社科视角 | 理工科实验范式 | 跨学科融合 |
| **验证机制** | 来源追溯 | 实验复现 | 双重验证 |
| **写作风格** | 活人感、可读性 | 学术规范 | 风格可选 |

### 结合场景

#### 场景A：技术产品的学术化研究
**流程**：
1. 用横纵分析法研究一个AI产品（如Claude Code）
2. 提取技术亮点作为研究假设
3. 用AutoResearchClaw设计实验验证
4. 输出：产品研究报告 + 学术论文

#### 场景B：研究趋势的深度解读
**流程**：
1. AutoResearchClaw自动生成某领域的文献综述
2. 用横纵分析法追溯该领域的发展历程
3. 结合输出：趋势分析报告 + 学术综述

#### 场景C：创业公司的技术壁垒分析
**流程**：
1. 横纵分析法：公司发展历程 + 竞品对比
2. AutoResearchClaw：技术方案的形式化验证
3. 输出：投资研究报告 + 技术白皮书

---

## 3. 技术集成方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    统一研究协调器                            │
│              (OpenClaw Agent as Orchestrator)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  横纵分析     │ │  知识    │ │ AutoResearch │
│  子Agent     │◄┤  合成    ├►│   子Agent    │
│              │ │  中心    │ │              │
└──────────────┘ └──────────┘ └──────────────┘
        │             │             │
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  研究报告     │ │  共享    │ │  学术论文    │
│  (PDF)       │ │  记忆    │ │  (LaTeX)     │
└──────────────┘ └──────────┘ └──────────────┘
```

### 数据流设计

```
用户输入研究主题
    │
    ▼
┌──────────────────┐
│ 阶段1: 研究定界   │ ──► 确定研究类型（产品/技术/概念）
└──────────────────┘
    │
    ├──► 产品/公司/人物 ──► 触发横纵分析流程
    │                           │
    │                           ▼
    │                   ┌──────────────────┐
    │                   │ 阶段2: 信息收集   │
    │                   │ - 纵向：历史脉络  │
    │                   │ - 横向：竞品对比  │
    │                   └──────────────────┘
    │                           │
    │                           ▼
    │                   ┌──────────────────┐
    │                   │ 阶段3: 深度分析   │
    │                   │ - 交汇洞察        │
    │                   │ - 未来推演        │
    │                   └──────────────────┘
    │                           │
    │                           ▼
    │                   ┌──────────────────┐
    │                   │ 阶段4: 报告生成   │
    │                   │ - Markdown写作    │
    │                   │ - PDF排版输出     │
    │                   └──────────────────┘
    │
    └──► 技术/学术问题 ──► 触发AutoResearch流程
                                │
                                ▼
                        ┌──────────────────┐
                        │ 阶段2: 文献发现   │
                        │ - arXiv/Semantic  │
                        │   Scholar API     │
                        └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ 阶段3: 假设生成   │
                        │ - 多Agent辩论     │
                        │ - 假设验证        │
                        └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ 阶段4: 实验设计   │
                        │ - 代码生成        │
                        │ - 实验执行        │
                        └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ 阶段5: 论文撰写   │
                        │ - LaTeX生成       │
                        │ - 引用验证        │
                        └──────────────────┘
```

---

## 4. 具体集成实现

### 4.1 共享记忆层

创建统一的知识存储格式：

```json
{
  "research_id": "uuid",
  "topic": "研究主题",
  "type": "product|technology|concept|company",
  "timestamp": "2026-04-13T10:00:00Z",
  "sources": {
    "longitudinal": [...],  // 横纵分析：纵向来源
    "cross_sectional": [...], // 横纵分析：横向来源
    "academic": [...]       // AutoResearch：学术文献
  },
  "insights": {
    "hv_analysis": {...},   // 横纵分析洞察
    "hypotheses": [...],    // AutoResearch假设
    "experimental_results": [...]
  },
  "outputs": {
    "report_pdf": "path/to/report.pdf",
    "paper_latex": "path/to/paper.tex"
  }
}
```

### 4.2 互调接口

#### 从横纵分析调用AutoResearch

```python
# 在hv-analysis的交汇洞察阶段，提取可验证的假设

def extract_research_hypotheses(hv_report):
    """从横纵分析报告中提取可学术验证的假设"""
    
    # 示例：从竞争分析中提取技术假设
    hypotheses = []
    
    # 假设1：技术路线A比技术路线B在X场景下性能更好
    if "技术路线对比" in hv_report:
        hypotheses.append({
            "statement": f"{tech_a} 在 {scenario} 场景下的性能优于 {tech_b}",
            "source": "横纵分析：横向对比章节",
            "testable": True,
            "metrics": ["latency", "accuracy", "cost"]
        })
    
    # 假设2：某技术决策导致的市场表现差异
    if "关键决策分析" in hv_report:
        hypotheses.append({
            "statement": f"{decision} 对 {company} 的 {metric} 有显著影响",
            "source": "横纵分析：决策逻辑章节",
            "testable": True,
            "metrics": ["market_share", "user_growth", "revenue"]
        })
    
    return hypotheses

# 调用AutoResearch验证
for hypothesis in hypotheses:
    if hypothesis["testable"]:
        run_autoresearch_claw(
            topic=hypothesis["statement"],
            hypothesis=hypothesis,
            sources_from_hv=hv_report["sources"]
        )
```

#### 从AutoResearch调用横纵分析

```python
# 在AutoResearch的文献综述阶段，需要背景研究

def generate_background_research(arxiv_papers):
    """为学术论文生成技术背景研究"""
    
    # 提取关键技术和产品
    technologies = extract_mentioned_tech(arxiv_papers)
    companies = extract_mentioned_companies(arxiv_papers)
    
    for tech in technologies:
        # 调用横纵分析研究生成背景
        hv_report = run_hv_analysis(
            target=tech,
            type="technology",
            focus="academic_context"
        )
        
        # 将背景信息注入论文的Related Work章节
        inject_background_to_latex(hv_report, paper_path)
```

### 4.3 联合输出模板

#### 组合报告结构

```markdown
# 联合研究报告：[研究主题]

> 本报告结合横纵分析法与AutoResearchClaw自动生成
> 生成时间：2026-04-13
> 研究类型：产品技术分析

---

## 第一部分：横纵分析（人文视角）

### 一、一句话定义
...

### 二、纵向分析：从诞生到当下
...

### 三、横向分析：竞争图谱
...

### 四、横纵交汇洞察
...

---

## 第二部分：学术研究（科学验证）

### 五、研究假设
（从横纵洞察中提取的可验证假设）

### 六、文献综述
（AutoResearch生成的学术背景）

### 七、实验设计
（基于假设的实验方案）

### 八、实验结果
（实际执行结果）

### 九、结论与讨论
（结合横纵洞察和实验验证的综合结论）

---

## 附录

- A. 横纵分析PDF完整版
- B. 学术论文LaTeX源码
- C. 实验代码与数据
- D. 引用来源清单
```

---

## 5. 实际使用示例

### 示例：研究 "MCP协议"

#### 步骤1：横纵分析
```bash
# 研究MCP协议的发展历程和生态
研究对象：MCP (Model Context Protocol)
类型：概念/技术
研究动机：理解MCP如何改变AI工具集成范式
```

**输出**：
- 纵向：从Anthropic提出到成为行业标准的演进
- 横向：与Function Calling、Plugin系统的对比
- 洞察：MCP作为"AI的USB-C"的统一价值

#### 步骤2：提取学术假设
从报告中提取：
- 假设1：MCP协议比传统API集成方式降低X%的开发成本
- 假设2：MCP生态的规模与工具质量呈正相关

#### 步骤3：AutoResearch验证
```bash
researchclaw run \
  --topic "MCP协议对AI工具开发效率的影响" \
  --hypothesis "MCP reduces integration cost by X%" \
  --auto-approve
```

**输出**：
- 文献综述：工具集成领域的相关研究
- 实验设计：对比实验方案
- 结果分析：统计验证
- 论文：符合ICLR格式的学术论文

#### 步骤4：联合报告
生成包含两部分的综合报告：
1. **人文视角**：MCP的发展故事和生态分析（可读性强）
2. **科学验证**：假设的实验验证和学术贡献（严谨规范）

---

## 6. 安装与配置

### 已安装组件

✅ **Khazix Skills**（已安装到 `~/.openclaw/skills/`）
- `hv-analysis`：横纵分析法Skill
- `khazix-writer`：卡兹克写作风格Skill

✅ **AutoResearchClaw**（已安装）
- 路径：`/home/admin/.openclaw/workspace/AutoResearchClaw`
- 版本：0.3.1
- 命令：`researchclaw`

### 依赖检查

```bash
# PDF生成依赖（已安装）
pip install weasyprint markdown --break-system-packages

# AutoResearchClaw依赖（需单独安装）
pip install -e ./AutoResearchClaw
```

---

## 7. 使用示例

### 快速开始

```bash
# 1. 使用横纵分析法研究一个主题
openclaw run hv-analysis --topic "OpenClaw" --type product

# 2. 从报告中提取假设并启动AutoResearch
openclaw run autoresearch --from-hv-report "OpenClaw_横纵分析报告.md"

# 3. 生成联合报告
openclaw run combine-reports \
  --hv-report "OpenClaw_横纵分析报告.pdf" \
  --paper "output/paper.tex" \
  --output "OpenClaw_联合研究报告.pdf"
```

---

## 8. 总结

### 结合价值

1. **研究深度**：人文叙事 + 科学验证的双重保障
2. **输出多样**：既有可读性强的报告，也有严谨的学术论文
3. **效率提升**：自动化流水线减少重复劳动
4. **质量保证**：横纵分析的溯源 + AutoResearch的验证

### 适用场景

- 技术产品分析（如研究Claude Code vs Cursor）
- 行业趋势研究（如AI Agent架构演进）
- 投资决策支持（如创业公司技术壁垒分析）
- 学术研究辅助（如文献综述 + 实验验证）

### 下一步行动

1. [x] 安装AutoResearchClaw ✅
2. [ ] 配置API密钥（OpenAI/Claude）
3. [ ] 测试联合流程（选择一个研究主题）
4. [ ] 优化集成脚本（自动化互调）
5. [ ] 建立研究记忆库（共享知识存储）

---

> 孪生于不同世界，彼此映照，共同演化。
> 
> 横纵分析法提供"为什么"的洞察，AutoResearchClaw提供"是不是"的验证。
> 两者结合，构成完整的认知闭环。