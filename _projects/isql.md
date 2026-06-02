---
layout: project
title: "iS-QL: Bridging Target-free and Target-based Reinforcement Learning"
description: "Parameter sharing between online and target networks (keeping only the final linear layer separate) closes the stability gap of target-free RL while halving memory, with gains across Atari, DMC, and language. Published at ICLR 2026."
img: assets/img/projects/isql_algorithm_cards.png
importance: 6
category: Featured Work
venue: "ICLR"
year: 2026
bib_key: "vincent2026bridging"
---

## Introduction

Deep reinforcement learning algorithms rely on accurate value estimates to learn good policies. A standard stabilization trick, the **target network**, maintains a delayed copy of the value network to compute training targets, preventing the moving-target instability that arises from bootstrapping with a rapidly changing network. Yet target networks come at a cost: they double the memory dedicated to Q-networks, which directly limits how large a network the GPU can fit. **iS-QL** (iterated Shared Q-Learning) sidesteps this binary trade-off by sharing all network parameters except the final output layer between the online and target sides, delivering target-based stability at near target-free memory cost.

*In this collaborative work (4th author), I designed and conducted the offline language model experiments — specifically the evaluation of iS-ILQL on the Wordle task using a GPT-2 backbone.*

## Problem Statement

- **Target networks** ([Mnih et al., 2015](https://www.nature.com/articles/nature14236)) stabilize training by decoupling the regression target from the changing online network. They are critical for large architectures and are shown to matter even for methods originally designed without them.
- The cost is **doubled memory footprint** for Q-networks, limiting usable network size on constrained hardware (edge devices, high-dimensional inputs, mixture-of-experts critics).
- **Target-free methods** avoid the extra memory but suffer severe performance drops: a 10–60% AUC gap relative to their target-based counterparts in standard benchmarks.
- **Gap:** No prior work escapes this binary choice. The question is whether a hybrid architecture can achieve target-based stability with target-free memory usage.

## Methodology

iS-QL uses a **single Q-network with K+1 linear output heads**, sharing all parameters in the backbone (convolutional or MLP body) while keeping the heads lightweight and separate.

**Architecture (Figure 1):**

{% include figure.liquid loading="eager" path="assets/img/projects/isql_algorithm_cards.png" title="iS-QL Algorithm Overview" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. Conceptual comparison of target-based, target-free, shared features, and iterated shared features (iS-QL). In the shared-features variant, only the last linear layer is duplicated as the target; the backbone is shared with the live online network. iS-QL extends this with K+1 heads forming a chain of consecutive Bellman iterations; each head is trained to approximate the Bellman update of the previous one. From <a href="https://arxiv.org/abs/2506.04398">Vincent et al., ICLR 2026</a>.
</div>

**Key ideas:**

- Let ω denote the shared backbone parameters and ω₀, ω₁, …, ω_K the K+1 head parameters. Define θ_k = (ω, ω_k).
- Head ω₀ is **never updated by gradient descent**; it plays the role of the target network.
- The training loss sums K temporal-difference objectives in a chain:

$$\mathcal{L}^{\text{iS-QL}}(\theta) = \sum_{k=1}^{K} \mathcal{L}^{\text{TD}}(\theta_k,\, \theta_{k-1})$$

  where head k−1 provides regression targets for head k (stop-gradient applied).

- Every T steps, heads are **cyclically shifted**: ω_k ← ω_{k+1} for k = 0, …, K−1. This propagates learned values backward through the chain and refreshes the frozen head ω₀ with a recent snapshot of ω₁, exactly as DQN's hard target update, but only for a tiny linear layer.

- Learning K consecutive Bellman iterations in parallel improves sample efficiency beyond simply sharing the backbone.

**Why it works: three mechanisms analysed in the paper:**

| Mechanism | Target-free | iS-QL K=1 | Target-based |
| :--- | :---: | :---: | :---: |
| Gradient alignment with target-based | low | **high** | — |
| Target churn (instability of regression targets) | high | **intermediate** | zero |
| Feature srank (representational capacity) | low | **higher** | moderate |

**Variants evaluated:**

- **iS-DQN** — discrete online RL (Atari)
- **iS-CQL** — discrete offline RL (Atari)
- **iS-SAC** — continuous online RL (DeepMind Control Suite)
- **iS-ILQL** — offline language RL (Wordle, GPT-2 small backbone)
- **iS-Stream Q(λ)** — streaming RL (no replay buffer, no batch updates)

## Results

All AUC scores are normalized by the target-based approach (= 100); higher is better. Results use IQM with 95% stratified bootstrap intervals.

### Online Discrete Control — Atari

Evaluated on 15 Atari games with CNN+LayerNorm:

| Method | Normalized AUC | Parameters vs target-based |
| :--- | :---: | :---: |
| TF-DQN (target-free) | 90% | ~50% |
| TB-DQN (target-based) | 100% | 100% |
| **iS-DQN K=9** | **106%** | **~50%** |

iS-DQN K=9 **outperforms the target-based approach by 6%** while using approximately half its parameters. Without LayerNorm, where target-free suffers a 60% performance drop, iS-DQN K=1 already cuts this gap to 18%, by storing only one lightweight linear head. Results on the IMPALA architecture confirm the trend: iS-DQN fully closes the performance gap as K increases.

### Offline Discrete Control — Atari

Evaluated on 10 Atari games with IMPALA+LayerNorm and CQL loss (10% of DQN dataset):

| Method | Performance gap vs target-based |
| :--- | :---: |
| TF-CQL (target-free) | −26% |
| **iS-CQL K=9** | **−6%** |

iS-CQL shrinks the offline performance gap from 26% to 6%.

### Online Continuous Control — DeepMind Control Suite

Evaluated on 7 hard DMC tasks with SAC+SimbaV2+BatchNorm:

- iS-SAC K=1 **fully recovers** the performance drop of the target-free approach.
- Reduces **total parameter count by 49%** (SimbaV2 uses a large critic; only the linear head is duplicated).

### Offline Language Modeling — Wordle

Evaluated with Implicit Language Q-Learning (ILQL) on the Wordle word-guessing game using GPT-2 small (264M parameters total):

{% include figure.liquid loading="eager" path="assets/img/projects/isql_wordle.png" title="iS-QL Wordle Results" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 2. Performance on the Wordle offline RL task (GPT-2 small backbone). iS-ILQL K=9 improves over the target-based approach by more than 5% in normalized AUC while saving 33% of RAM (88 million parameters). Sharing features also enables computing the TD error in a single forward pass, reducing training time. From <a href="https://arxiv.org/abs/2506.04398">Vincent et al., ICLR 2026</a>.
</div>

| Method | Normalized AUC | Parameters |
| :--- | :---: | :---: |
| TF-ILQL | ≈ TB-ILQL | −88M vs TB |
| TB-ILQL | 100% | 264M |
| **iS-ILQL K=9** | **> 105%** | **264M − 88M = 176M** |

iS-ILQL K=9 **outperforms the target-based approach by more than 5%** and saves 88 million parameters (33% RAM reduction). Because both the online and target embeddings share a single forward pass, iS-ILQL also trains faster than TB-ILQL.

### Streaming RL — Atari (no replay buffer)

Applied to Stream Q(λ) [[Elsayed et al., 2024](https://arxiv.org/abs/2410.10939)] on 7 Atari games without replay buffer or batch updates:

- iS-Stream Q(λ) K=3 improves over the target-free baseline by **more than 10%** in AUC, matching or outperforming the target-based reference on **6 out of 7 games**.

## Conclusion

- **Simple modification, broad impact:** Sharing all parameters except the final linear head reduces memory to near target-free levels while restoring target-based stability across five distinct RL settings.
- **Iterated Bellman updates amplify the gain:** Learning K consecutive Bellman updates in parallel with the shared backbone significantly narrows, and in some settings eliminates, the performance gap with target-based methods.
- **Scalable to large architectures:** The 49% total parameter reduction on SimbaV2 and 33% RAM saving on GPT-2 confirm practical value for memory-constrained hardware.
- **Analysis-backed:** Gradient alignment, target churn, and srank measurements all confirm that iS-QL's learning dynamics are systematically closer to target-based than target-free, explaining the empirical gains.
- **Orthogonal to existing regularization:** iS-QL combines additively with LayerNorm, BatchNorm, MellowMax, and other target-free stabilizers; the gains are complementary.

---

## References

1. **Vincent, T., Tripathi, Y., Faust, T., Akgül, A., Oren, Y., Kandemir, M., Peters, J., & D'Eramo, C. (2026).** Bridging the Performance-gap between Target-free and Target-based Reinforcement Learning. *Fourteenth International Conference on Learning Representations (ICLR 2026).*
2. **Mnih, V., et al. (2015).** Human-level control through deep reinforcement learning. *Nature, 518.*
3. **Vincent, T., et al. (2025).** Iterated Q-Network: Beyond One-Step Bellman Updates in Deep Reinforcement Learning. *arXiv:2403.02107.*
4. **Gallici, M., et al. (2025).** Simplifying Deep Temporal Difference Learning. *ICLR 2025.*
5. **Bhatt, A., et al. (2024).** CrossQ: Batch Normalization in Deep Reinforcement Learning for Greater Sample Efficiency and Simplicity. *ICLR 2024.*
6. **Snell, C., et al. (2023).** Offline RL for Natural Language Generation with Implicit Language Q Learning. *ICLR 2023.*
7. **Elsayed, M., et al. (2024).** Streaming Deep Reinforcement Learning Finally Works. *arXiv:2410.10939.*
8. **Lee, H., et al. (2025).** Hyperspherical Normalization for Scalable Deep Reinforcement Learning. *arXiv:2502.15280.*
