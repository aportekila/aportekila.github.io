---
layout: project
title: "MOMBO: Deterministic Uncertainty Propagation for Offline RL"
description: "Moment matching replaces Monte Carlo sampling in pessimistic offline RL, cutting suboptimality and accelerating convergence across D4RL benchmarks. Published at NeurIPS 2024."
img: assets/img/projects/mombo_mm_vs_mc.png
importance: 2
category: Featured Work
venue: "NeurIPS"
year: 2024
bib_key: "akgul2024deterministic"
---

## Introduction

Offline reinforcement learning (learning policies from pre-collected datasets without environment interaction) is essential for high-stakes domains where real-world exploration is costly or dangerous (healthcare, robotics, autonomous driving). The core obstacle is **distributional shift**: value estimates for actions underrepresented in the dataset become inflated, with no corrective feedback. **MOMBO** (Moment Matching Offline Model-Based Policy Optimization) identifies the root cause of training instability in model-based offline RL: high-variance Bellman targets from Monte Carlo sampling. MOMBO fixes this with deterministic moment matching, yielding provably faster convergence.

## Problem Statement

- Model-based offline RL methods (MOPO, MOBILE) apply **Pessimistic Value Iteration (PEVI)**: penalize Q-value estimates by the learned dynamics model's uncertainty to keep the policy conservative about unseen state-action pairs.
- All existing PEVI methods sample a **single next state** (N=1) from the Gaussian dynamics model and evaluate the Q-network on it. A single sample is cheap but injects **high variance** into every Bellman target.
- This high variance corrupts gradient updates, slows convergence, and forces larger penalty coefficients to compensate, making model-based offline RL often slower than model-free approaches despite having access to synthetic data.
- **Theoretically:** suboptimality scales as O(1/√N) in the number of MC samples. At N=1, the bound is at its weakest; at N=1 it is also undefined in the limit, revealing a fundamental limitation.
- **Gap:** No existing method propagates next-state uncertainty analytically through the Q-network, despite this being the direct source of training instability.

## Methodology

MOMBO replaces Monte Carlo sampling with **progressive moment matching**: the Gaussian next-state distribution output by the learned dynamics model is propagated through the Q-network layer by layer, analytically tracking the mean and variance of hidden activations.

**Pessimistic Bellman target (exact, no sampling):**

$$\hat{\mathcal{B}}_\text{pess} = r + \gamma \mu_\text{MM} - \beta \gamma \sigma_\text{MM}$$

<div class="row justify-content-center">
<div class="col-sm-8">
{% include figure.liquid loading="eager" path="assets/img/projects/mombo_mm_vs_mc.png" title="Moment Matching vs Monte Carlo Sampling" class="img-fluid rounded z-depth-1" %}
</div>
</div>
<div class="caption">
  Figure 1. Moment matching versus Monte Carlo sampling on halfcheetah-medium-expert-v2. Moment matching (two forward passes) achieves sharp mean/variance estimates of the Q-value at the next state; even 10,000 MC samples fail to match this sharpness. Tighter Bellman targets reduce gradient noise and accelerate convergence throughout training.
</div>

**Implementation details:**
- **Linear layers:** transform mean and variance analytically (exact Gaussian propagation)
- **ReLU activations:** compute the first two moments via the Gaussian CDF/PDF (closed-form)
- **Result:** a Normal distribution over Q-values at each next state, used directly to form the pessimistic target (mean − β × std)
- Requires only two forward passes; no additional parameters or rollouts

**Theoretical improvement over MC-based PEVI:**

| Method | Bound type | Key term |
| :--- | :--- | :--- |
| MC-based PEVI (N=1) | Probabilistic (holds w/ prob 1−δ) | Scales with R²_max/(1−γ)² |
| MOMBO | **Deterministic** (always holds) | Depends only on network activation constants G_l, C_l ≤ 1 |

MOMBO's bound is strictly tighter: it holds without probability qualification and depends only on the network's Lipschitz structure.

## Results

Evaluated on the **D4RL offline benchmark** across 12 environment-dataset combinations: halfcheetah, hopper, and walker2d × random, medium, medium-replay, and medium-expert (4 seeds). Two metrics: Normalized Reward (final policy quality) and AULC (area under the learning curve, measuring convergence speed and stability).

MOMBO achieves the **best average AULC ranking of 1.2** across all 12 settings:

| Dataset type | MOPO AULC rank | MOBILE AULC rank | MOMBO AULC rank |
| :--- | :---: | :---: | :---: |
| random | 2.7 | 2.0 | **1.3** |
| medium | 2.7 | 2.0 | **1.3** |
| medium-replay | 2.3 | 2.0 | **1.7** |
| medium-expert | 2.7 | 2.0 | **1.3** |
| **Overall** | 2.7 | 2.2 | **1.2** |

<p class="small text-muted">Rank 1 = best. Lower is better.</p>

Selected AULC scores on the most practically relevant settings:

| Task | MOMBO | MOBILE | MOPO |
| :--- | :---: | :---: | :---: |
| medium — hopper | **95.9 ± 2.5** | 82.2 ± 7.3 | 37.0 ± 15.3 |
| medium — walker2d | **84.0 ± 1.1** | 79.0 ± 1.3 | 77.6 ± 1.3 |
| medium-replay — hopper | **87.3 ± 2.0** | 78.7 ± 4.0 | 81.7 ± 4.6 |
| medium-expert — halfcheetah | **95.2 ± 0.7** | 94.5 ± 1.8 | 77.1 ± 4.0 |
| medium-expert — walker2d | **98.9 ± 3.3** | 94.3 ± 0.9 | 88.3 ± 6.3 |

MOMBO's advantage is largest on AULC rather than final reward, directly confirming the lower-variance Bellman target hypothesis. The medium-hopper gap (95.9 vs 82.2 vs 37.0) is the most striking: MOPO's high variance under medium-quality data collapses entirely, while MOMBO stays stable.

## Conclusion

- **Root cause identified:** High MC variance in Bellman targets (not model quality) is the primary source of instability in model-based offline RL.
- **Provably tighter guarantees:** MOMBO's deterministic suboptimality bound improves on probabilistic MC bounds; constants depend only on network architecture, not on reward scale or sample count.
- **Fastest convergence:** Best AULC ranking of 1.2 across all 12 D4RL settings; most striking on medium-hopper (AULC 95.9 vs 82.2 vs 37.0).
- **Minimal overhead:** Moment matching requires only two forward passes through the Q-network, with no additional parameters or MC rollouts.
- **Practically relevant:** Advantage is largest on medium-quality datasets (the norm in real applications), where MC variance is most destructive to learning stability.

---

## References

1. **Akgül, A., Haußmann, M., & Kandemir, M. (2024).** Deterministic Uncertainty Propagation for Improved Model-Based Offline Reinforcement Learning. *NeurIPS 2024.* [arXiv:2406.04088](https://arxiv.org/abs/2406.04088)
2. **Jin, Y., Yang, Z., & Wang, Z. (2021).** Is Pessimism Provably Efficient for Offline RL? *ICML 2021.*
3. **Yu, T., Thomas, G., Yu, L., Ermon, S., Zou, J. Y., Levine, S., Finn, C., & Ma, T. (2020).** MOPO: Model-based Offline Policy Optimization. *NeurIPS 2020.*
4. **Sun, Y., et al. (2023).** Model-Bellman Inconsistency for Model-based Offline Reinforcement Learning. *ICML 2023.*
5. **Wu, A., Nowozin, S., Meeds, E., Turner, R. E., Hernández-Lobato, J. M., & Gaunt, A. L. (2019).** Deterministic Variational Inference for Robust Bayesian Neural Networks. *ICLR 2019.*
6. **Fu, J., Kumar, A., Nachum, O., Tucker, G., & Levine, S. (2020).** D4RL: Datasets for Deep Data-Driven Reinforcement Learning. *arXiv:2004.07219.*
