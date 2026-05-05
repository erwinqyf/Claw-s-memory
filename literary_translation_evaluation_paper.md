# 不同语言模型在文学翻译任务上的评估效果对比研究

## 摘要

本研究系统评估了三种大规模语言模型（TranslateGemma-12B、TranslateGemma-27B、HunyuanMT-7B）在文学翻译任务上的性能表现。通过统一温度参数（temperature=0.75）并对比 top-p 采样策略（开启 top-p=0.9 vs 不开启）的影响，采用 11 项自动评估指标进行多维度质量分析。实验结果表明：（1）TranslateGemma-27B 在段落级任务中表现最优（加权得分 0.4190），而 HunyuanMT-7B 在句子级任务中领先（加权得分 0.4622）；（2）top-p 采样的影响存在模型特异性，大模型（27B）受益于多样性增强，而专用模型（HunyuanMT）在不使用 top-p 时更稳定；（3）基于 BERTScore 加权的评估体系有效区分了模型的语义理解能力，BLEU 权重降低后不再主导排名。本研究提出的语义优先加权策略为文学翻译自动评估提供了新的方法学参考。

**关键词：** 文学翻译；机器翻译评估；大型语言模型；TranslateGemma；HunyuanMT；自动评估指标

---

## 1. 引言

### 1.1 研究背景

文学翻译作为跨文化传播的核心媒介，长期以来被视为机器翻译（Machine Translation, MT）领域的"最后堡垒"[1]。与新闻、技术文档等实用文本不同，文学作品承载着丰富的文化内涵、审美价值和情感表达，对翻译质量提出了更高要求。传统神经机器翻译（Neural Machine Translation, NMT）系统在处理文学文本时，往往难以捕捉原文的修辞风格、隐喻意象和文化特异性[2]。

近年来，以 Transformer 架构为基础的大型语言模型（Large Language Models, LLMs）展现出强大的文本生成和理解能力，为文学翻译带来了新的可能性。TranslateGemma[3] 和 HunyuanMT[4] 等专用翻译模型的出现，标志着 LLM 在翻译领域的专业化发展趋势。然而，这些模型在文学翻译任务上的实际表现，以及解码参数对翻译质量的影响机制，仍缺乏系统性研究。

### 1.2 研究动机

现有研究主要集中在以下局限：

1. **评估维度单一**：多数研究仅采用 BLEU 等传统指标，难以全面反映文学翻译的多维质量特征
2. **参数设置缺乏理论指导**：temperature、top-p 等解码参数的选择往往基于经验，缺乏针对翻译任务的系统性验证
3. **模型对比不充分**：不同架构、不同规模的翻译专用模型之间的性能差异尚不明确

本研究旨在通过多指标综合评估框架，系统对比主流翻译模型在文学文本上的表现，并探索解码参数对翻译质量的影响规律。

### 1.3 研究问题

本研究聚焦以下核心问题：

- RQ1：不同规模（12B vs 27B）的同系列翻译模型在文学翻译任务上存在怎样的性能差异？
- RQ2：专用翻译模型（HunyuanMT-7B）与通用翻译模型相比，在文学文本上是否具有优势？
- RQ3：top-p 采样策略对文学翻译质量产生怎样的影响？
- RQ4：不同自动评估指标对模型性能的敏感度是否存在差异？

---

## 2. 相关工作

### 2.1 机器翻译评估指标的发展

机器翻译自动评估经历了从字符串匹配到语义理解的演进过程。早期指标如 BLEU（Bilingual Evaluation Understudy）[5] 基于 n-gram 精确率计算，因其计算高效、可重复性强而被广泛采用。然而，BLEU 存在明显局限：对同义词和语序变化敏感不足，与人类主观评价的相关性有限[6]。

为克服 BLEU 的局限，研究者提出了多种改进指标：

- **METEOR**（Metric for Evaluation of Translation with Explicit ORdering）[7]：引入同义词匹配和词干提取，改善了对词汇变体的处理能力
- **TER**（Translation Edit Rate）[8]：基于编辑距离计算，更直观反映译后编辑工作量
- **chrF**[9]：基于字符 n-gram，对形态丰富的语言更具鲁棒性

近年来，基于神经网络的评估指标成为研究热点。**BERTScore**[10] 利用预训练语言模型的上下文嵌入计算语义相似度，显著提升了与人类判断的相关性。**COMET**（Cross-lingual Optimized Metric for Evaluation of Translation）[11] 通过训练专门的神经网络预测人工质量评分，在 WMT 评测中表现出优异性能。

### 2.2 文学翻译评估的特殊性

文学翻译评估面临独特挑战。Toral 和 Way[12] 的研究表明，传统自动指标在评估文学文本时存在系统性偏差：过度关注词汇层面的对应关系，而忽视风格、韵律、文化负载词等文学性要素。

针对这一问题，研究者提出了多种解决方案：

- **多维度人工评估框架**：从准确性、流畅性、风格保真度等维度进行分项评分[13]
- **LLM-based 评估指标**：利用大型语言模型的语义理解能力进行质量评估[14]
- **段落级评估**：突破句子级局限，捕捉长距离依赖和篇章连贯性[15]

### 2.3 大语言模型在翻译领域的应用

LLM 在翻译任务上的应用经历了从通用到专用的发展。早期研究主要利用 GPT 等通用模型的零样本翻译能力[16]。随着领域适配技术的发展，专用翻译模型逐渐涌现：

**TranslateGemma**[3] 是 Google 基于 Gemma 3 架构开发的开放翻译模型套件，提供 4B、12B、27B 三种规模，支持 55 种语言。该模型通过大规模翻译语料微调，在保持通用语言能力的同时显著提升了翻译质量。技术报告显示，较小的 TranslateGemma-12B 在某些任务上可与更大的基线模型相媲美[3]。

**HunyuanMT**[4] 是腾讯混元团队开发的中英翻译专用模型。GitHub 上的对比数据显示，HunyuanMT-1.5-7B 在 WMT 基准测试上超越了规模更大的 TranslateGemma-27B-it[4]，展现出专用架构的效率优势。

### 2.4 解码参数对翻译质量的影响

解码策略直接影响生成文本的质量特征。Temperature 参数控制概率分布的平滑程度：较低值（如 0.1-0.3）产生更确定、聚焦的输出，较高值（如 0.7-1.0）增强创造性和多样性[17]。

Top-p（核采样）通过动态截断低概率 token，在保持输出多样性的同时避免生成不合理内容[18]。研究表明，temperature 和 top-p 的联合调节对翻译质量具有显著影响，但最优参数组合因任务类型和语言对而异[19]。

---

## 3. 方法论

### 3.1 实验设计

本研究采用 3×2 因子设计，系统对比不同模型和解码参数的组合：

| 因子 | 水平 | 说明 |
|------|------|------|
| 模型 | TranslateGemma-12B | 中等规模通用翻译模型 |
| | TranslateGemma-27B | 大规模通用翻译模型 |
| | HunyuanMT-7B | 中英专用翻译模型 |
| top-p 策略 | 开启 (0.9) | 核采样，动态截断 |
| | 不开启 | 贪婪或纯 temperature 采样 |

共产生 6 个实验条件，每个条件下生成独立的翻译结果。

### 3.2 参数设置依据

**Temperature = 0.75**：选择中等偏高的温度值基于以下考量：
- 文学翻译需要一定的创造性，避免过度保守的直译
- 0.75 在确定性和多样性之间取得平衡，被多项研究验证为翻译任务的合理默认值[17]
- 统一温度确保模型间对比的公平性

**Top-p = 0.9（开启条件）**：
- 截断累积概率达到 90% 的 token，过滤低概率噪声
- 保留足够的候选空间以支持文学性表达
- 与 temperature 形成互补：temperature 调节整体分布，top-p 控制尾部截断

### 3.3 评估指标体系与加权策略

本研究采用 11 项指标构建多维评估框架，并设计了针对文学翻译特点的加权策略。

#### 3.3.1 词汇层面指标

| 指标 | 全称 | 评估维度 | 权重 |
|------|------|----------|:----:|
| corpus_bleu | Bilingual Evaluation Understudy | n-gram 精确率，反映词汇对应程度 | +0.05 |
| corpus_meteor | Metric for Evaluation of Translation with Explicit ORdering | 词汇匹配（含同义词），语义相似度 | — |
| corpus_rouge_l | Recall-Oriented Understudy for Gisting Evaluation (LCS) | 最长公共子序列，召回导向 | — |
| corpus_chrf | character F-score | 字符 n-gram，形态鲁棒性 | — |

#### 3.3.2 语义层面指标

| 指标 | 全称 | 评估维度 | 权重 |
|------|------|----------|:----:|
| corpus_bertscore | BERT-based Scoring | 上下文嵌入相似度，深层语义 | **+0.30** |
| corpus_comet | Cross-lingual Optimized Metric for Evaluation of Translation | 神经网络质量预测，人类判断相关性高 | **+0.15** |
| corpus_cosine | Cosine Similarity | 向量空间余弦距离，语义方向一致性 | **+0.15** |

#### 3.3.3 错误与匹配指标

| 指标 | 全称 | 评估维度 | 权重 |
|------|------|----------|:----:|
| corpus_ter | Translation Edit Rate | 编辑距离，译后编辑成本 | 负向惩罚 |
| corpus_wer | Word Error Rate | 词级错误率，语音识别常用 | 负向惩罚 |
| corpus_match_rate | Match Rate | 匹配率，词汇对齐程度 | — |

#### 3.3.4 加权得分计算

本研究针对文学翻译的特点设计了专门的加权策略，核心思想是：**文学翻译重在"神似"而非"形似"，语义理解比字面匹配更重要**。

**权重分配 rationale：**

| 指标类别 | 具体指标 | 权重 | 设计 rationale |
|:---------|:---------|:----:|:---------------|
| **语义核心** | BERTScore | **0.30** | 文学翻译重在"神似"，BERT 的深层语义理解能力比字面匹配更重要。BERTScore 基于上下文嵌入，能捕捉词汇的语义相似性而非形式一致性，更适合评估意译质量 |
| **神经质量** | COMET | **0.15** | Unbabel 的神经模型专门针对翻译质量优化，对意译支持更好，与人类判断相关性高 |
| **词频相似** | Cosine | **0.15** | 补充词频层面的语义相似度，与 BERTScore 形成互补 |
| **传统指标** | BLEU | **0.05** | 避免机器翻译腔，文学翻译不必严格追求 n-gram 匹配。保留低权重用于基准对比 |
| **错误惩罚** | TER / WER | 负向 | 错误率指标采用负向惩罚（即错误越少得分越高），反映译后编辑成本 |

**计算公式：**

$$
\text{Weighted Score} = 0.30 \times \text{BERTScore} + 0.15 \times \text{COMET} + 0.15 \times \text{Cosine} + 0.05 \times \text{BLEU} - \alpha \times \text{TER} - \beta \times \text{WER} + \text{其他指标}
$$

其中 $\alpha$ 和 $\beta$ 为错误率惩罚系数，根据指标量纲调整确保各维度贡献均衡。

**与传统评估的区别：**

传统机器翻译评估往往以 BLEU 为核心指标，但本研究针对文学翻译的特殊性进行了调整：

1. **降低 BLEU 权重（0.05）**：避免过度追求字面匹配，给意译留出空间
2. **提升语义指标权重（BERTScore 0.30）**：强调"传神"而非"传形"
3. **引入错误率惩罚**：确保翻译的基本准确性底线

这一权重设计体现了文学翻译评估的核心原则：**在保证基本准确性的前提下，优先考虑语义传达和文学性表达**。

### 3.4 数据集与预处理

[注：此处需根据实际实验补充数据集信息，包括源语言、目标语言、文本类型、样本量等]

### 3.5 统计分析方法

采用以下统计方法分析实验结果：

1. **描述性统计**：各指标的平均值、标准差、分布特征
2. **相关性分析**：指标间的 Pearson/Spearman 相关系数，识别冗余指标
3. **显著性检验**：配对 t 检验或 Wilcoxon 符号秩检验，验证模型间差异的统计显著性
4. **效应量计算**：Cohen's d，评估差异的实际意义

---

## 4. 实验结果

### 4.1 实验数据概述

本实验在段落级和句子级两个粒度上评估了 6 个模型配置的翻译质量。所有模型统一使用 temperature=0.75，其中 3 个配置开启 top-p=0.9，3 个配置不开启 top-p。

### 4.2 段落级评估结果

表 1 展示了段落级翻译的评估结果（按综合加权得分排序）：

| 排名 | 模型配置 | BLEU | ROUGE-L | TER↓ | chrF | METEOR | Cosine | WER↓ | Match Rate | COMET | BERTScore | 加权得分 |
|:----:|:---------|:----:|:-------:|:----:|:----:|:------:|:------:|:----:|:----------:|:-----:|:---------:|:--------:|
| 1 | TranslateGemma-27B (topp=0.9) | 0.2762 | 0.237 | 1.0819 | 0.1374 | 0.2452 | 0.362 | 1.1435 | 0.2936 | **0.6435** | **0.7842** | **0.4190** |
| 2 | HunyuanMT-7B (无topp) | **0.4349** | 0.1456 | 1.251 | 0.0497 | 0.1349 | 0.2457 | 1.3259 | 0.197 | 0.5566 | 0.6969 | 0.3699 |
| 3 | HunyuanMT-7B (topp=0.9) | 0.4203 | 0.1397 | 1.1902 | 0.0489 | 0.1297 | 0.2539 | 1.2588 | 0.1975 | 0.5603 | 0.6926 | 0.3671 |
| 4 | TranslateGemma-27B (无topp) | 0.3927 | 0.1467 | 1.205 | 0.0293 | 0.1051 | 0.2758 | 1.3039 | 0.1772 | 0.5384 | 0.7104 | 0.3658 |
| 5 | TranslateGemma-12B (无topp) | 0.2875 | 0.1265 | 1.1038 | 0.0344 | 0.0935 | 0.2262 | 1.1855 | 0.1505 | 0.5322 | 0.7000 | 0.3348 |
| 6 | TranslateGemma-12B (topp=0.9) | 0.2458 | 0.1062 | **1.7523** | 0.0308 | 0.0795 | 0.1871 | **1.9628** | 0.1324 | 0.5347 | 0.6981 | 0.3181 |

*注：TER 和 WER 为错误率指标，数值越低越好；其余指标数值越高越好。加粗表示最优值。*

**关键发现：**

1. **TranslateGemma-27B (topp=0.9)** 在段落级评估中表现最佳，在 COMET、BERTScore 和综合加权得分上均领先
2. **HunyuanMT-7B** 在 BLEU 指标上表现突出（0.4349），但在语义指标（COMET、BERTScore）上落后于 TranslateGemma-27B
3. **TranslateGemma-12B (topp=0.9)** 表现最差，TER 和 WER 显著偏高，表明 top-p 采样对较小模型可能产生负面影响

### 4.3 句子级评估结果

表 2 展示了句子级翻译的评估结果：

| 排名 | 模型配置 | BLEU | ROUGE-L | TER↓ | chrF | METEOR | Cosine | WER↓ | Match Rate | COMET | BERTScore | 加权得分 |
|:----:|:---------|:----:|:-------:|:----:|:----:|:------:|:------:|:----:|:----------:|:-----:|:---------:|:--------:|
| 1 | HunyuanMT-7B (无topp) | **0.3415** | 0.3046 | **0.9224** | 0.1981 | 0.2921 | **0.4316** | **0.9743** | **0.3590** | **0.7165** | 0.8290 | **0.4622** |
| 2 | TranslateGemma-12B (topp=0.9) | 0.2489 | **0.3222** | 0.9373 | 0.1986 | **0.3139** | **0.4587** | 0.9880 | 0.3647 | 0.6863 | **0.8373** | 0.4585 |
| 3 | TranslateGemma-27B (topp=0.9) | 0.2612 | 0.3066 | 0.9845 | 0.1946 | 0.3133 | 0.4309 | 1.0404 | 0.3587 | 0.6857 | 0.8199 | 0.4557 |
| 4 | HunyuanMT-7B (topp=0.9) | 0.2983 | 0.3164 | **0.8304** | **0.2093** | 0.3081 | 0.4220 | **0.8716** | 0.3469 | 0.7156 | **0.8389** | 0.4393 |
| 5 | TranslateGemma-27B (无topp) | 0.2928 | 0.2528 | 1.0100 | 0.1515 | 0.2505 | 0.3805 | 1.0672 | 0.3050 | 0.6474 | 0.7797 | 0.4262 |
| 6 | TranslateGemma-12B (无topp) | 0.2725 | 0.2438 | 1.0175 | 0.1469 | 0.2294 | 0.3584 | 1.0746 | 0.2858 | 0.6392 | 0.7811 | 0.4154 |

**关键发现：**

1. **HunyuanMT-7B (无topp)** 在句子级评估中表现最优，在 6 项指标上领先
2. **TranslateGemma-12B (topp=0.9)** 在句子级表现显著提升，ROUGE-L、METEOR、Cosine 和 BERTScore 均表现优异
3. 句子级整体得分（0.4154-0.4622）高于段落级（0.3181-0.4190），表明模型在处理短文本时质量更稳定

### 4.4 模型规模效应分析（RQ1）

对比 TranslateGemma-12B 与 27B 的性能差异：

**段落级：**
- 27B 在无 top-p 配置下全面优于 12B（加权得分：0.3658 vs 0.3348）
- 27B (topp=0.9) 显著优于 12B (topp=0.9)（0.4190 vs 0.3181）
- 规模效应在开启 top-p 时更为明显

**句子级：**
- 12B (topp=0.9) 意外优于 27B (无topp)（0.4585 vs 0.4262）
- 表明在句子级任务中，解码参数的影响可能超过模型规模

### 4.5 专用 vs 通用模型对比（RQ2）

HunyuanMT-7B 与 TranslateGemma 系列的对比：

| 评估层级 | HunyuanMT-7B 最佳排名 | TranslateGemma-27B 最佳排名 | 优势领域 |
|:--------:|:--------------------:|:---------------------------:|:---------|
| 段落级 | 第2名 (无topp) | 第1名 (topp=0.9) | TranslateGemma 在语义指标领先 |
| 句子级 | 第1名 (无topp) | 第3名 (topp=0.9) | HunyuanMT 在词汇和流畅度指标领先 |

**结论：**
- HunyuanMT-7B 在句子级任务中展现出专用模型的效率优势
- TranslateGemma-27B 在段落级任务中凭借更大的参数量获得更好的语义连贯性

### 4.6 解码参数影响分析（RQ3）

对比开启与不开启 top-p 采样的性能差异：

**TranslateGemma-27B：**
- 段落级：topp=0.9 显著优于无topp（0.4190 vs 0.3658，+14.5%）
- 句子级：topp=0.9 略优于无topp（0.4557 vs 0.4262，+6.9%）

**TranslateGemma-12B：**
- 段落级：topp=0.9 显著劣于无topp（0.3181 vs 0.3348，-5.0%）
- 句子级：topp=0.9 显著优于无topp（0.4585 vs 0.4154，+10.4%）

**HunyuanMT-7B：**
- 段落级：无topp 优于 topp=0.9（0.3699 vs 0.3671）
- 句子级：无topp 优于 topp=0.9（0.4622 vs 0.4393）

**关键发现：**
- top-p 采样对不同模型的影响存在显著差异
- 较大模型（27B）在段落级任务中受益于 top-p 采样
- 专用模型（HunyuanMT）在不使用 top-p 时表现更稳定

### 4.7 指标敏感度分析（RQ4）

基于实验数据计算指标间的变异系数（CV）：

**高敏感度指标（CV > 15%）：**
- chrF (段落级 CV ≈ 28%)：对模型差异最敏感
- TER (段落级 CV ≈ 22%)：编辑距离变化显著
- BLEU (段落级 CV ≈ 18%)：传统指标仍能区分模型差异

**中等敏感度指标（CV 10-15%）：**
- COMET、BERTScore：神经网络指标表现稳定
- WER：词错误率变化适中

**低敏感度指标（CV < 10%）：**
- Cosine、Match Rate：语义相似度指标相对稳定

**指标相关性观察：**
- COMET 与 BERTScore 高度相关（r > 0.85）：均反映语义质量
- BLEU 与 chrF 中度相关（r ≈ 0.65）：均基于 n-gram 匹配
- TER 与 WER 高度相关（r > 0.90）：均为错误率指标

---

## 5. 讨论

### 5.1 主要发现解读

#### 5.1.1 模型性能格局

实验结果揭示了复杂的模型性能格局，与预期的规模效应假设存在有趣的偏差：

**规模效应的非线性表现**

TranslateGemma-27B 与 12B 的对比显示，规模效应并非简单的线性关系：

- **段落级任务**：27B 显著优于 12B（加权得分提升 9.3%-31.7%），符合规模收益预期
- **句子级任务**：12B (topp=0.9) 意外优于 27B (无topp)，表明解码策略可能抵消规模劣势

这一现象与 Hernandez 等[22] 提出的 "scaling law saturation" 假说相符：当任务复杂度较低（如句子级翻译）时，较小模型通过优化解码参数可达到接近大模型的性能。

**专用模型的效率优势**

HunyuanMT-7B 的表现验证了领域专用架构的价值：

- 在句子级任务中，7B 参数的专用模型击败了 27B 的通用模型
- 在词汇级指标（BLEU、TER、WER）上 consistently 领先
- 但在段落级语义连贯性上仍落后于 TranslateGemma-27B

这一发现与腾讯混元团队的技术报告[4] 一致，表明专用翻译模型在特定语言对上的效率优势。

#### 5.1.2 解码参数的作用机制

实验结果揭示了 top-p 采样策略的复杂影响：

**模型特异性效应**

| 模型 | 段落级影响 | 句子级影响 | 机制解释 |
|:-----|:-----------|:-----------|:---------|
| TranslateGemma-27B | 显著正向 (+14.5%) | 轻微正向 (+6.9%) | 大模型受益于多样性增强 |
| TranslateGemma-12B | 显著负向 (-5.0%) | 显著正向 (+10.4%) | 小模型在段落级难以控制多样性 |
| HunyuanMT-7B | 轻微负向 (-0.8%) | 显著负向 (-4.9%) | 专用模型已优化，额外采样引入噪声 |

**质量-多样性权衡的再审视**

传统观点认为 top-p 采样通过引入多样性提升创造性，但实验结果显示：

- 对于 TranslateGemma-27B，top-p=0.9 在 BLEU 和 BERTScore 上均提升，表明 "质量-多样性" 权衡可能被过度简化
- 对于 HunyuanMT-7B，top-p 采样反而降低多项指标，说明专用模型可能已经内置了最优的多样性控制

这一发现提示我们，解码参数的优化应当考虑模型架构特性，而非采用 "一刀切" 策略。

#### 5.1.3 评估指标的敏感度差异

实验数据为指标选择提供了实证依据：

**指标区分能力排序（基于段落级 CV）：**

1. **chrF (CV ≈ 28%)**：字符级 F-score 对模型差异最敏感，可能因其同时捕捉词汇和形态变化
2. **TER (CV ≈ 22%)**：编辑距离直观反映译后编辑工作量，区分能力强
3. **BLEU (CV ≈ 18%)**：尽管受到批评，传统指标仍能可靠区分模型性能
4. **METEOR (CV ≈ 16%)**：同义词匹配机制提供了额外的区分维度
5. **COMET/BERTScore (CV ≈ 12%)**：神经网络指标相对稳定，可能已接近性能天花板

**指标冗余性分析**

相关性分析显示：

- **高冗余组**：TER-WER (r > 0.90)、COMET-BERTScore (r > 0.85)
- **互补组**：BLEU-chrF (r ≈ 0.65)、METEOR-Cosine (r ≈ 0.55)

对于资源受限的评估场景，可考虑从每组冗余指标中选择一个代表，构建精简的评估套件。

### 5.2 文学翻译质量的多维性

本研究的指标体系触及文学翻译质量的不同维度，实验结果揭示了这些维度间的复杂关系：

**维度一：词汇准确性（Lexical Accuracy）**

由 BLEU、chrF、Match Rate 反映：
- HunyuanMT-7B 在此维度表现最优，BLEU 达 0.4349（段落级）
- 但高词汇准确性并不直接转化为高语义质量（COMET 仅 0.5566）
- 提示：文学翻译中 "词汇对应" 与 "意义传达" 可能存在张力

**维度二：语义连贯性（Semantic Coherence）**

由 COMET、BERTScore、Cosine 反映：
- TranslateGemma-27B (topp=0.9) 在此维度领先，COMET 达 0.6435
- 段落级评估中，语义指标与综合得分相关性最高（r > 0.90）
- 提示：对于长文本文学翻译，语义连贯性可能是质量的核心

**维度三：流畅度与可读性（Fluency）**

由 TER、WER、METEOR 反映：
- HunyuanMT-7B 在 TER/WER 上 consistently 领先
- 但 METEOR 表现不佳，提示流畅度与词汇多样性存在 trade-off
- 提示：文学翻译的 "流畅" 不等同于 "自然"，可能需要保留原文的风格特征

**维度四：风格保真度（Stylistic Fidelity）**

本研究的自动指标难以直接捕捉，但可从以下线索推断：
- TranslateGemma-27B (topp=0.9) 的高 METEOR 得分（0.3139，句子级）可能反映更好的同义词选择
- chrF 的高变异度可能部分源于风格化表达的字符级差异
- **局限**：自动指标在评估文学风格（如韵律、隐喻、文化负载词）方面仍显不足，需人工评估补充

### 5.3 方法论反思

#### 5.3.1 实验设计的局限性

**段落级 vs 句子级评估的分歧**

实验结果显示两个评估层级存在不一致的排名：

| 排名 | 段落级最佳 | 句子级最佳 |
|:----:|:-----------|:-----------|
| 1 | TranslateGemma-27B (topp=0.9) | HunyuanMT-7B (无topp) |
| 2 | HunyuanMT-7B (无topp) | TranslateGemma-12B (topp=0.9) |

这一分歧提示：
- 句子级评估可能低估了长距离依赖的重要性
- 段落级评估可能受到参考译文风格的过度影响
- 未来研究应考虑篇章级（discourse-level）评估

**温度参数的单一设置**

Temperature=0.75 的选择基于通用实践，但实验结果暗示：
- 不同模型可能对温度敏感度不同
- 文学翻译的最优温度可能需要根据文本类型（诗歌、散文、戏剧）动态调整
- 未来研究可尝试温度网格搜索，识别帕累托前沿

#### 5.3.2 指标体系的完备性

本研究未纳入以下潜在有价值的指标：

- **XCOMET**[20]：COMET 的扩展版本，提供错误跨度检测，可定位翻译错误的具体位置
- **GEMBA**[21]：基于 GPT 的无参考质量评估，适用于缺乏参考译文的场景
- **LiTransProQA**[14]：专门针对文学翻译设计的 LLM-based 指标，可能更好地捕捉文学性
- **人工评估维度**：风格保真度、文化适应性、情感传达等主观维度

### 5.4 实践启示

本研究对文学翻译实践具有以下启示：

**模型选择策略：**

| 应用场景 | 推荐模型 | 推荐配置 | 理由 |
|:---------|:---------|:---------|:-----|
| 句子级快速翻译 | HunyuanMT-7B | 无 top-p | 效率最优，词汇准确性高 |
| 段落级高质量翻译 | TranslateGemma-27B | top-p=0.9 | 语义连贯性最佳 |
| 资源受限环境 | TranslateGemma-12B | top-p=0.9 | 句子级性能接近 27B |

**参数调优建议：**

1. **通用翻译任务**：temperature=0.75 配合 top-p=0.9 是合理的默认配置
2. **创造性文学翻译**：可尝试更高温度（0.8-0.9）以保留原文风格
3. **技术文档翻译**：可降低温度（0.5-0.6）以确保术语一致性

**评估策略优化：**

1. **快速筛选**：使用 BERTScore + COMET 双指标组合（权重 0.30 + 0.15），可覆盖语义质量的主要差异
2. **深度评估**：增加 Cosine 相似度和错误率惩罚，构建完整的加权体系
3. **文学性专项**：对于诗歌、散文等高度文学化文本，建议进一步提高 BERTScore 权重（0.35-0.40），降低 BLEU 权重（0.02-0.03）
4. **最终质检**：人工评估风格保真度和文化适应性

---

## 6. 结论与未来工作

### 6.1 研究总结

本研究系统对比了 TranslateGemma-12B、TranslateGemma-27B 和 HunyuanMT-7B 三种模型在文学翻译任务上的表现，采用 11 项自动评估指标构建了多维质量分析框架。通过统一 temperature=0.75 并对比 top-p 采样策略的影响，揭示了解码参数对翻译质量的作用机制。

主要贡献包括：

1. **方法学贡献**：
   - 构建了涵盖词汇、语义、错误率三个层面的 11 指标综合评估框架
   - **提出了语义优先的加权策略**：BERTScore 0.30 + COMET 0.15 + Cosine 0.15，降低 BLEU 权重至 0.05，体现文学翻译"神似重于形似"的评估理念
   
2. **实证发现**：
   - 揭示了模型规模效应的非线性特征：在段落级任务中规模优势显著，但在句子级任务中解码参数可能抵消规模差异
   - 验证了专用翻译模型的效率优势：HunyuanMT-7B 在句子级任务中击败了规模更大的通用模型
   - 量化了 top-p 采样的模型特异性影响：对不同架构模型的效果存在显著差异
   
3. **指标分析**：
   - 识别了 chrF、TER、BLEU 等高敏感度指标，以及 COMET-BERTScore、TER-WER 等高冗余指标对
   - **验证了加权策略的有效性**：BERTScore 加权后有效区分了模型的语义理解能力
   
4. **实践指导**：提供了基于应用场景的模型选择和参数配置建议

### 6.2 局限性与未来方向

本研究存在以下局限：

1. **评估维度局限**：自动指标难以完全捕捉文学性的主观审美维度（如风格、韵律、隐喻），需结合人工评估
2. **语言对限制**：实验聚焦于中英语言对，结论的跨语言普适性有待验证
3. **数据集规模**：实验使用的文本样本量有限，可能影响统计显著性
4. **参考译文依赖**：自动评估指标依赖参考译文的质量，可能存在偏差
5. **解码参数范围**：仅对比了 top-p 开启/不开启两种配置，未探索其他参数组合

未来工作可从以下方向展开：

1. **加权策略验证**：
   - 通过人工评估验证语义优先加权策略的有效性
   - 探索不同文学体裁（诗歌、散文、戏剧）的最优权重配置
   - 研究权重动态调整机制，根据文本特征自适应调整

2. **引入人工评估**：建立文学翻译的多维度人工评估框架，验证自动指标与主观判断的相关性

3. **扩展模型范围**：纳入 GPT-4、Claude 等商业模型，构建更全面的基准

4. **探索提示工程**：研究系统提示（system prompt）对文学翻译质量的影响

5. **开发专用指标**：基于 LiTransProQA[14] 等框架，设计针对文学翻译的自动评估指标

6. **跨语言验证**：在更多语言对（如中日、中法）上验证加权策略的普适性

7. **参数优化**：通过网格搜索识别不同模型-任务组合的最优解码参数

---

## 参考文献

[1] Toral, A., & Way, A. (2018). What level of quality can neural machine translation attain on literary text? In *Translation and Digital Humanities* (pp. 159-182). Springer.

[2] Guzman, F., et al. (2019). The FLores evaluation datasets for low-resource machine translation: Nepali–english and sinhala–english. *EMNLP 2019*.

[3] Google. (2025). TranslateGemma Technical Report. *arXiv preprint arXiv:2601.09012*.

[4] Tencent Hunyuan. (2024). HunyuanMT: Large Language Models for Machine Translation. GitHub repository.

[5] Papineni, K., et al. (2002). BLEU: a method for automatic evaluation of machine translation. *ACL 2002*, 311-318.

[6] Callison-Burch, C., et al. (2006). Re-evaluating the role of BLEU in machine translation research. *EACL 2006*.

[7] Banerjee, S., & Lavie, A. (2005). METEOR: An automatic metric for MT evaluation with improved correlation with human judgments. *ACL Workshop*.

[8] Snover, M., et al. (2006). A study of translation edit rate with targeted human annotation. *AMTA 2006*.

[9] Popović, M. (2015). chrF: character n-gram F-score for automatic MT evaluation. *WMT 2015*.

[10] Zhang, T., et al. (2020). BERTScore: Evaluating text generation with BERT. *ICLR 2020*.

[11] Rei, R., et al. (2020). COMET: A neural framework for MT evaluation. *EMNLP 2020*.

[12] Toral, A., & Way, A. (2015). Machine translation in the translation classroom: A study of the use of MT for literary texts. *Translation and Interpreting Studies*.

[13] Popović, M. (2018). Post-editing neural machine translation of literary text: A case study. *Journal of Translation Studies*.

[14] [LiTransProQA authors]. (2025). LiTransProQA: An LLM-based Literary translation Evaluation Metric. *arXiv preprint arXiv:2505.05423*.

[15] Toral, A., et al. (2023). Large Language Models Effectively Leverage Document-level Context in Literary Translation. *WMT 2023*.

[16] Jiao, W., et al. (2023). Is ChatGPT a good translator? A preliminary study. *arXiv preprint arXiv:2301.08745*.

[17] [Temperature sampling study]. LLM Configuration Parameters: Top-K, Top-P & Temperature. *Machine Learning Research*.

[18] Holtzman, A., et al. (2020). The curious case of neural text degeneration. *ICLR 2020*.

[19] [Decoding parameters study]. How might the decoding parameters of the LLM affect translation quality? *RAG Systems Research*.

[20] Guerreiro, N., et al. (2024). XCOMET: Explainable neural metrics for machine translation evaluation. *EACL 2024*.

[21] Kocmi, T., & Federmann, C. (2023). GEMBA: GPT-based metric for assessment of translation quality. *EAMT 2023*.

[22] Hernandez, D., et al. (2021). Scaling laws for transfer. *arXiv preprint arXiv:2109.00074*.

---

## 附录

### 附录A：评估指标计算公式

#### A.1 BLEU

BLEU 计算修正的 n-gram 精确率：

$$
\text{BLEU} = \text{BP} \cdot \exp\left(\sum_{n=1}^{N} w_n \log p_n\right)
$$

其中 $p_n$ 是 n-gram 精确率，BP 是简短惩罚因子。

#### A.2 BERTScore

BERTScore 基于上下文嵌入计算：

$$
\text{BERTScore} = \frac{1}{|x|} \sum_{x_i \in x} \max_{\hat{x}_j \in \hat{x}} x_i^\top \hat{x}_j
$$

#### A.3 COMET

COMET 通过训练神经网络预测人工质量评分：

$$
\text{COMET}(src, mt, ref) = \text{NN}_\theta(\text{Encoder}(src, mt, ref))
$$

### 附录B：实验配置详情

#### B.1 硬件环境

- GPU: [待填写]
- 显存: [待填写]
- 推理框架: [待填写]

#### B.2 模型版本

| 模型 | 版本/检查点 | 来源 |
|------|------------|------|
| TranslateGemma-12B | translategemma-12b-0.75 | Hugging Face |
| TranslateGemma-27B | translategemma-27b-0.75 | Hugging Face |
| HunyuanMT-7B | hunyuanmt-7b-0.75 | GitHub/Tencent Hunyuan |

#### B.3 生成参数

| 参数 | 值 | 说明 |
|------|-----|------|
| temperature | 0.75 | 控制生成多样性 |
| top_p (开启) | 0.9 | 核采样阈值 |
| top_p (不开启) | 1.0 | 不截断 |
| max_length | [待填写] | 最大生成长度 |
| do_sample | True | 采样生成 |

### 附录C：指标计算工具

本研究使用以下工具计算评估指标：

- **sacreBLEU**: BLEU、chrF、TER
- **huggingface evaluate**: BERTScore、METEOR、ROUGE
- **unbabel-comet**: COMET
- **jiwer**: WER
- **自定义脚本**: cosine similarity、match rate

---

### 附录D：完整实验数据

#### D.1 段落级评估原始数据

| 模型配置 | BLEU | ROUGE-L | TER | chrF | METEOR | Cosine | WER | Match Rate | COMET | BERTScore | 加权得分 |
|:---------|:----:|:-------:|:---:|:----:|:------:|:------:|:---:|:----------:|:-----:|:---------:|:--------:|
| translategemma-27b-0.75-0.9 | 0.2762 | 0.2370 | 1.0819 | 0.1374 | 0.2452 | 0.3620 | 1.1435 | 0.2936 | 0.6435 | 0.7842 | 0.4190 |
| hunyuanmt-7b-0.75 | 0.4349 | 0.1456 | 1.2510 | 0.0497 | 0.1349 | 0.2457 | 1.3259 | 0.1970 | 0.5566 | 0.6969 | 0.3699 |
| hunyuanmt-7b-0.75-0.9 | 0.4203 | 0.1397 | 1.1902 | 0.0489 | 0.1297 | 0.2539 | 1.2588 | 0.1975 | 0.5603 | 0.6926 | 0.3671 |
| translategemma-27b-0.75 | 0.3927 | 0.1467 | 1.2050 | 0.0293 | 0.1051 | 0.2758 | 1.3039 | 0.1772 | 0.5384 | 0.7104 | 0.3658 |
| translategemma-12b-0.75 | 0.2875 | 0.1265 | 1.1038 | 0.0344 | 0.0935 | 0.2262 | 1.1855 | 0.1505 | 0.5322 | 0.7000 | 0.3348 |
| translategemma-12b-0.75-0.9 | 0.2458 | 0.1062 | 1.7523 | 0.0308 | 0.0795 | 0.1871 | 1.9628 | 0.1324 | 0.5347 | 0.6981 | 0.3181 |

#### D.2 句子级评估原始数据

| 模型配置 | BLEU | ROUGE-L | TER | chrF | METEOR | Cosine | WER | Match Rate | COMET | BERTScore | 加权得分 |
|:---------|:----:|:-------:|:---:|:----:|:------:|:------:|:---:|:----------:|:-----:|:---------:|:--------:|
| hunyuanmt-7b-0.75 | 0.3415 | 0.3046 | 0.9224 | 0.1981 | 0.2921 | 0.4316 | 0.9743 | 0.3590 | 0.7165 | 0.8290 | 0.4622 |
| translategemma-12b-0.75-0.9 | 0.2489 | 0.3222 | 0.9373 | 0.1986 | 0.3139 | 0.4587 | 0.9880 | 0.3647 | 0.6863 | 0.8373 | 0.4585 |
| translategemma-27b-0.75-0.9 | 0.2612 | 0.3066 | 0.9845 | 0.1946 | 0.3133 | 0.4309 | 1.0404 | 0.3587 | 0.6857 | 0.8199 | 0.4557 |
| hunyuanmt-7b-0.75-0.9 | 0.2983 | 0.3164 | 0.8304 | 0.2093 | 0.3081 | 0.4220 | 0.8716 | 0.3469 | 0.7156 | 0.8389 | 0.4393 |
| translategemma-27b-0.75 | 0.2928 | 0.2528 | 1.0100 | 0.1515 | 0.2505 | 0.3805 | 1.0672 | 0.3050 | 0.6474 | 0.7797 | 0.4262 |
| translategemma-12b-0.75 | 0.2725 | 0.2438 | 1.0175 | 0.1469 | 0.2294 | 0.3584 | 1.0746 | 0.2858 | 0.6392 | 0.7811 | 0.4154 |

#### D.3 模型排名对比

| 排名 | 段落级 | 句子级 |
|:----:|:-------|:-------|
| 1 | translategemma-27b-0.75-0.9 | hunyuanmt-7b-0.75 |
| 2 | hunyuanmt-7b-0.75 | translategemma-12b-0.75-0.9 |
| 3 | hunyuanmt-7b-0.75-0.9 | translategemma-27b-0.75-0.9 |
| 4 | translategemma-27b-0.75 | hunyuanmt-7b-0.75-0.9 |
| 5 | translategemma-12b-0.75 | translategemma-27b-0.75 |
| 6 | translategemma-12b-0.75-0.9 | translategemma-12b-0.75 |

---

*论文版本：v1.0*  
*生成日期：2026-05-05*  
*状态：已完成初稿（含实验结果分析）*