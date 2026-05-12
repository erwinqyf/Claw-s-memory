# WAICA 2026 Format Paper - Literary Translation Evaluation Study

---

## Contribution Title

**不同语言模型在文学翻译任务上的评估效果对比研究**
*(Comparative Study of Evaluation Effects of Different Language Models on Literary Translation Tasks)*

---

## Author

**[Author Name]**

---

## Address

**[Institute/Organization]**

---

## Abstract

**Background:** Literary translation evaluation faces the core contradiction between "spiritual resemblance" and "formal resemblance," with traditional BLEU-centric systems struggling to capture deep quality characteristics.

**Methods:** This study evaluates the performance of three large models (TranslateGemma-12B/27B, HunyuanMT-7B) on literary translation tasks, comparing the impact of top-p sampling strategies. A semantic-prioritized nine-indicator weighted evaluation system was adopted (BERTScore 0.25 > BLEU 0.15).

**Results:** (1) TranslateGemma-27B performed optimally at paragraph level (0.4190), while HunyuanMT-7B led at sentence level (0.4622); (2) top-p effects showed model-specific characteristics; (3) the weighted strategy effectively identified translations where "spiritual resemblance" surpassed "formal resemblance."

**Conclusion:** The semantic-prioritized weighted strategy provides methodological reference for automatic evaluation of literary translation.

---

## Keywords

Literary Translation; Machine Translation Evaluation; Large Language Models; BERTScore; Semantic-Prioritized Evaluation; TranslateGemma; HunyuanMT

---

## 1 Introduction

Literary translation has long been regarded as the "last bastion" of machine translation (Toral & Way, 2018). Unlike news and technical documentation, literary works carry rich cultural connotations and aesthetic values, placing higher demands on translation quality. However, traditional evaluation metrics (such as BLEU) are based on n-gram matching, focusing excessively on "formal resemblance" while neglecting "spiritual resemblance," making it difficult to capture the deep quality characteristics of literary translation.

This study proposes a **semantic-prioritized weighted evaluation strategy**, constructing a multi-dimensional evaluation system suitable for literary translation characteristics by increasing the weights of semantic indicators such as BERTScore and reducing BLEU weights. Experimental results demonstrate that this strategy effectively identifies translations where "spiritual resemblance" surpasses "formal resemblance," providing new methodological references for automatic evaluation of literary translation.

**Contributions of this paper:**
- **Methodological contribution**: Proposes a nine-indicator semantic-prioritized weighted strategy (BERTScore 0.25 > BLEU 0.15), clarifying the core contradiction between "spiritual resemblance" and "formal resemblance"
- **Empirical findings**: Reveals the non-linear characteristics of model scaling effects and the model-specific impact of top-p sampling
- **Validation effectiveness**: Models with high BERTScore receive the highest weighted scores, while models with merely high BLEU rank second

### 1.1 Research Background

Literary translation, as a core medium for cross-cultural communication, has long been regarded as the "last bastion" in the field of Machine Translation (MT) (Toral & Way, 2018). Unlike practical texts such as news and technical documentation, literary works carry rich cultural connotations, aesthetic values, and emotional expressions, placing higher demands on translation quality. Traditional Neural Machine Translation (NMT) systems often struggle to capture the rhetorical style, metaphorical imagery, and cultural specificity of literary texts when processing them (Guzmán et al., 2019).

In recent years, Large Language Models (LLMs) based on Transformer decoder architectures have demonstrated powerful text generation capabilities, bringing new possibilities to literary translation. The emergence of dedicated translation models such as TranslateGemma (Google, 2025) and HunyuanMT (Tencent Hunyuan, 2024) marks the professional development trend of LLMs in the translation field.

Meanwhile, **new paradigms for translation quality assessment based on LLMs** are emerging. Next-generation evaluation metrics such as GEMBA (Kocmi & Federmann, 2023), Prometheus 2 (Kim et al., 2024), and LiTransProQA (Zhang et al., 2025) leverage the semantic understanding capabilities of LLMs to achieve reference-free evaluation without reference translations and support customizable evaluation dimensions. These metrics demonstrate advantages that traditional metrics cannot match in capturing the "spiritual resemblance" of literary translation.

However, multi-dimensional automatic evaluation metric weighting strategies for literary translation, as well as the influence mechanisms of decoding parameters on translation quality, still lack systematic research. This study aims to fill this gap by constructing a semantic-prioritized multi-indicator weighted evaluation framework to systematically compare the performance of mainstream translation models on literary texts and explore the influence patterns of decoding parameters on translation quality.

### 1.2 Research Motivation

Existing research mainly focuses on the following limitations:

1. **Single evaluation dimension**: Most studies only adopt traditional metrics such as BLEU, making it difficult to comprehensively reflect the multi-dimensional quality characteristics of literary translation (Li et al., 2025)
2. **Lack of theoretical guidance for parameter settings**: The selection of decoding parameters such as temperature and top-p is often based on experience, lacking systematic verification for translation tasks
3. **Insufficient model comparison**: Performance differences between translation-specific models of different architectures and scales remain unclear

Furthermore, although domestic research on machine translation quality evaluation has made certain progress (Wang et al., 2021; Zhang et al., 2024), systematic evaluation research targeting the special field of literary translation remains insufficient. This study aims to systematically compare the performance of mainstream translation models on literary texts through a multi-indicator comprehensive evaluation framework and explore the influence patterns of decoding parameters on translation quality.

### 1.3 Research Questions

This study focuses on the following core questions:

- **RQ1**: What performance differences exist between same-series translation models of different scales (12B vs 27B) on literary translation tasks?
- **RQ2**: Does the dedicated translation model (HunyuanMT-7B) have advantages over general-purpose translation models on literary texts?
- **RQ3**: What impact does the top-p sampling strategy have on literary translation quality?
- **RQ4**: Do different automatic evaluation indicators show varying sensitivity to model performance?

---

## 2 Related Work

### 2.1 Development of Machine Translation Evaluation Metrics

Machine translation automatic evaluation has evolved from string matching to semantic understanding. Early metrics such as BLEU (Bilingual Evaluation Understudy) (Papineni et al., 2002), based on n-gram precision calculation, were widely adopted due to their computational efficiency and strong reproducibility. However, BLEU has obvious limitations: insufficient sensitivity to synonyms and word order changes, and limited correlation with human subjective evaluation (Callison-Burch et al., 2006).

To overcome the limitations of BLEU, researchers have proposed various improved metrics:

- **METEOR** (Banerjee & Lavie, 2005): Introduces synonym matching and stemming to improve handling of lexical variants
- **TER** (Snover et al., 2006): Based on edit distance calculation, more intuitively reflecting post-editing workload
- **chrF** (Popović, 2015): Based on character n-gram,