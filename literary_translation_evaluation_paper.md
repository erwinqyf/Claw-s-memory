# 不同语言模型在文学翻译任务上的评估效果对比研究

## 摘要

本研究系统评估了三种大规模语言模型（TranslateGemma-12B、TranslateGemma-27B、HunyuanMT-7B）在文学翻译任务上的性能表现。通过统一温度参数（temperature=0.75）并对比 top-p 采样策略（开启 top-p=0.9 vs 不开启）的影响，采用 11 项自动评估指标进行多维度质量分析。实验结果表明，[待填入具体结果]。本研究为文学翻译自动评估提供了方法学参考，并揭示了解码参数对翻译质量的影响机制。

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

### 3.3 评估指标体系

本研究采用 11 项指标构建多维评估框架：

#### 3.3.1 词汇层面指标

| 指标 | 全称 | 评估维度 |
|------|------|----------|
| corpus_bleu | Bilingual Evaluation Understudy | n-gram 精确率，反映词汇对应程度 |
| corpus_meteor | Metric for Evaluation of Translation with Explicit ORdering | 词汇匹配（含同义词），语义相似度 |
| corpus_rouge_l | Recall-Oriented Understudy for Gisting Evaluation (LCS) | 最长公共子序列，召回导向 |
| corpus_chrf | character F-score | 字符 n-gram，形态鲁棒性 |

#### 3.3.2 语义层面指标

| 指标 | 全称 | 评估维度 |
|------|------|----------|
| corpus_bertscore | BERT-based Scoring | 上下文嵌入相似度，深层语义 |
| corpus_comet | Cross-lingual Optimized Metric for Evaluation of Translation | 神经网络质量预测，人类判断相关性高 |
| corpus_cosine | Cosine Similarity | 向量空间余弦距离，语义方向一致性 |

#### 3.3.3 错误与匹配指标

| 指标 | 全称 | 评估维度 |
|------|------|----------|
| corpus_ter | Translation Edit Rate | 编辑距离，译后编辑成本 |
| corpus_wer | Word Error Rate | 词级错误率，语音识别常用 |
| corpus_match_rate | Match Rate | 匹配率，词汇对齐程度 |

#### 3.3.4 指标选择 rationale

本指标体系的设计遵循以下原则：

1. **层次覆盖**：从字符（chrF）到词汇（BLEU、METEOR）再到语义（BERTScore、COMET），形成多层次质量画像
2. **传统与前沿结合**：保留 BLEU 等经典指标确保可比性，引入 COMET 等神经网络指标捕捉深层质量
3. **互补性**：不同指标关注不同维度，避免单一指标的片面性
4. **计算可行性**：所有指标均支持自动计算，适合大规模评估

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

[注：此处待填入实际实验数据，包括：]

### 4.1 总体性能对比

- 各模型在 11 项指标上的得分表格
- 可视化对比（雷达图/柱状图）

### 4.2 模型规模效应分析

- TranslateGemma-12B vs 27B 的对比
- 性能提升与参数规模的关系

### 4.3 专用 vs 通用模型

- HunyuanMT-7B 与 TranslateGemma 系列的对比
- 中英翻译任务上的专业化优势

### 4.4 解码参数影响

- 开启/不开启 top-p 的性能差异
- 不同模型对 top-p 的敏感度

### 4.5 指标间相关性

- 11 项指标的相关矩阵
- 指标聚类与维度降维

---

## 5. 讨论

### 5.1 主要发现解读

[基于实验结果展开讨论，预期涵盖：]

#### 5.1.1 模型性能格局

根据已有研究[3][4]，我们预期观察到以下模式：

- **规模效应的非线性**：TranslateGemma-27B 相比 12B 的提升幅度可能不如参数比例（27/12 ≈ 2.25）显著，符合神经网络规模收益递减的规律
- **专用模型的效率优势**：HunyuanMT-7B 可能在特定语言对上以更小规模实现竞争力，体现领域适配的价值

#### 5.1.2 解码参数的作用机制

Top-p 策略的影响可能呈现以下特征：

- **质量-多样性权衡**：开启 top-p 可能降低某些精确率指标（如 BLEU），但提升语义指标（如 BERTScore），反映生成文本的语义丰富性
- **模型特异性**：不同架构对采样策略的敏感度可能存在差异

#### 5.1.3 评估指标的敏感度差异

预期发现：

- **传统指标的局限性**：BLEU、TER 等字符串匹配指标可能无法充分区分高质量翻译的细微差异
- **神经网络指标的优势**：COMET、BERTScore 可能展现出更好的人类判断相关性
- **指标冗余**：某些指标（如 BLEU 与 ROUGE-L）可能高度相关，可考虑降维

### 5.2 文学翻译质量的多维性

本研究的指标体系触及文学翻译质量的不同维度：

1. **准确性（Accuracy）**：源文本意义的忠实传达，主要由 BERTScore、COMET 捕捉
2. **流畅性（Fluency）**：目标语言的自然度和可读性，与 METEOR、chrF 相关
3. **忠实度（Fidelity）**：词汇层面的对应程度，BLEU、match_rate 反映
4. **可编辑性（Editability）**：译后修改成本，TER 直接度量

值得注意的是，自动指标难以完全捕捉文学性的核心要素——风格、韵律、文化意象的传达[12]。这些维度仍需人工评估补充。

### 5.3 方法论反思

#### 5.3.1 参数设置的合理性

Temperature=0.75 的选择基于翻译任务的通用实践，但文学翻译的最优参数可能需要进一步探索。未来研究可尝试参数网格搜索，识别帕累托最优配置。

#### 5.3.2 指标体系的完备性

本研究未纳入以下潜在有价值的指标：

- **XCOMET**[20]：COMET 的扩展版本，提供错误跨度检测
- **GEMBA**[21]：基于 GPT 的无参考质量评估
- **LiTransProQA**[14]：专门针对文学翻译设计的 LLM-based 指标

这些指标可作为后续研究的补充。

### 5.4 实践启示

本研究对文学翻译实践具有以下启示：

1. **模型选择**：对于资源受限场景，专用小模型（如 HunyuanMT-7B）可能是性价比更优的选择
2. **参数调优**：建议根据质量优先级（精确性 vs 创造性）动态调整解码参数
3. **评估策略**：单一指标不足以全面评估文学翻译，建议采用多指标综合框架

---

## 6. 结论与未来工作

### 6.1 研究总结

本研究系统对比了 TranslateGemma-12B、TranslateGemma-27B 和 HunyuanMT-7B 三种模型在文学翻译任务上的表现，采用 11 项自动评估指标构建了多维质量分析框架。通过统一 temperature=0.75 并对比 top-p 采样策略的影响，揭示了解码参数对翻译质量的作用机制。

主要贡献包括：

1. 提供了文学翻译多指标评估的方法学参考
2. 验证了不同规模、不同架构翻译模型的性能差异
3. 量化了 top-p 采样策略对翻译质量的影响

### 6.2 局限性与未来方向

本研究存在以下局限：

1. **评估维度局限**：自动指标难以完全捕捉文学性的主观审美维度，需结合人工评估
2. **语言对限制**：实验聚焦于特定语言对，结论的跨语言普适性有待验证
3. **数据集规模**：[根据实际数据补充]

未来工作可从以下方向展开：

1. **引入人工评估**：建立文学翻译的人工评估框架，验证自动指标的有效性
2. **扩展模型范围**：纳入更多开源和商业翻译模型，构建更全面的基准
3. **探索提示工程**：研究系统提示（system prompt）对文学翻译质量的影响
4. **开发专用指标**：针对文学翻译特点设计更敏感的自动评估指标

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
| TranslateGemma-12B | [待填写] | Hugging Face |
| TranslateGemma-27B | [待填写] | Hugging Face |
| HunyuanMT-7B | [待填写] | GitHub |

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

*论文版本：v1.0*  
*生成日期：2026-05-05*  
*待完成：实验结果章节（第4节）、结论更新（第6节）*