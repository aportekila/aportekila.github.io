---
layout: project
title: "BFL: Aggregating Variational Bayesian Networks in Federated Learning"
description: "An empirical survey of five statistical aggregation rules for Variational Bayesian Neural Networks in federated learning, revealing that the variance (spread) of the aggregated distribution is the dominant factor in federated performance. Published at NeurIPS 2022."
img: assets/img/projects/bfl_fig1.png
importance: 9
category: Featured Work
venue: "NeurIPS 2022 Workshop"
year: 2022
bib_key: "ozer2022bfl"
---

## Introduction

Federated Learning (FL) enables multiple data centers or devices to collaboratively train a shared model **without sharing raw data**, making it essential for privacy-sensitive applications such as healthcare and finance. While most FL methods use deterministic neural networks, real-world safety-critical deployments require not only accurate predictions but also calibrated **uncertainty estimates**. Variational Bayesian Neural Networks (VBNNs) provide this capability by treating network weights as probability distributions rather than fixed values. However, the standard FL aggregation strategy (FedAvg) was designed for point-estimate weights and cannot be directly applied to distributional weights. **BFL** (Bayesian Federated Learning) is the first systematic empirical survey of statistical aggregation rules for VBNNs in the federated setting, identifying when and why different strategies succeed or fail.

*In this work (3rd author), I supervised two undergraduate students on implementation, structured the survey, and led the writing and editing of the manuscript.*

## Problem Statement

- **FedAvg and its deterministic variants** aggregate model parameters by (weighted) averaging scalars. When model weights are Gaussian distributions, a naive extension is ambiguous: how should two Gaussian distributions be merged into one global distribution?
- **Different aggregation rules yield fundamentally different distributions.** As illustrated in Figure 1, combining two client distributions with different rules can produce global distributions with very different means and variances, making the choice of aggregation rule a design decision with significant empirical consequences.
- **No prior work** had systematically investigated the effect of the aggregation rule choice on VBNNs trained with Variational Inference in a federated setting; existing probabilistic FL methods (FedPA, pFedBayes, FedSparse) address different concerns.
- **Gap:** It is unknown which statistical properties of the aggregated distribution (its variance, in particular) matter most for accuracy, calibration, and uncertainty quantification.

## Methodology

**Five aggregation rules** are derived and evaluated, all operating on the Gaussian weight distributions (parameterized by mean μ and variance σ²) of each client's VBNN:

| Rule | Aggregated Variance | Key Property |
| :--- | :--- | :--- |
| **EAA** — Empirical Arithmetic Aggregation | Weighted average of σ² | Naive extension of FedAvg; high spread |
| **GAA** — Gaussian Arithmetic Aggregation | Weighted average of σ² × β_k | Uses Gaussian sum rule; σ²_GAA < σ²_EAA always |
| **AALV** — Arithmetic Aggregation with Log Variance | Geometric mean of σ² | Equivalent to FedAvg gradient averaging for log σ² |
| **PPA** — Population Pooling Based Aggregation | Empirical variance of pooled samples | Sampling-based; computationally heavier |
| **CF** — Conflation Aggregation | Precision-weighted combination | Product of distributions; tends toward low spread |

$$\mu_{CF} = \frac{\sum_k \beta_k \mu_k / \sigma_k^2}{\sum_k \beta_k / \sigma_k^2}, \qquad \sigma^2_{CF} = \frac{\beta_{\max}}{\sum_k \beta_k / \sigma_k^2}$$

{% include figure.liquid loading="eager" path="assets/img/projects/bfl_fig1.png" title="BFL Aggregation Methods" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. Illustration of the five aggregation rules applied to two client weight distributions (depicted as Gaussians). After local training, clients send their weight distributions to the server; the server applies the aggregation rule and returns the resulting global distribution. Different rules produce substantially different distributions, varying in both mean and variance, which motivates a principled comparison.
</div>

{% include figure.liquid loading="eager" path="assets/img/projects/bfl_fig2.png" title="Aggregation Rule Comparison — Four Scenarios" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 2. Four scenarios comparing the five aggregation rules on pairs of Gaussian client distributions with varying means and variances (shown as dashed black curves). EAA (orange) and PPA (dark blue) consistently produce wider aggregated distributions; GAA (purple), AALV (cyan), and CF (green) maintain tighter, lower-variance results. This spread difference, which seems small in toy examples, compounds dramatically when aggregating across hundreds of clients.
</div>

**Two federation frameworks** are considered: **FVBA** (equal client weights, β_k = 1/K) and **FVBWA** (data-size-weighted, β_k = |D_k|/|D|). Deterministic baselines FED (uniform weights) and FEDAVG (size-weighted) serve as comparisons.

**Architecture:** Convolutional network (two 5×5 conv layers + three linear layers); variational Bayesian layers replace deterministic linear layers, parameterizing each weight as (μ, log σ²).

**Datasets:** Three image classification benchmarks, each with 10 labels: Fashion-MNIST (FMNIST, 60K train), CIFAR-10 (50K train), and SVHN (73K train).

**Experiments:** Two client settings (10 active clients vs. 100 total / 10 active) × two data partitions (IID and non-IID via Dirichlet distribution), 5 seeds. Evaluation uses accuracy (Acc ↑), Expected Calibration Error (ECE ↓), and Negative Log-Likelihood (NLL ↓). 

## Results

**10-client experiment — all aggregation rules viable.** With a coarser data split (fewer clients), high-spread methods remain competitive. VBNNs with lower spread (GAA, AALV, CF) match or exceed deterministic baselines on accuracy while providing substantially better calibration:

| Setting | FED (Acc/ECE) | FVBA + GAA (Acc/ECE) | FVBA + CF (Acc/ECE) |
| :--- | :---: | :---: | :---: |
| FMNIST — IID | 89.62 / 7.99 | 89.82 / 6.38 | 89.90 / 6.35 |
| Cifar-10 — IID | 70.09 / 3.35 | **71.29** / **3.11** | **71.17** / **2.81** |
| SVHN — non-IID | 86.65 / 9.88 | 87.52 / 6.24 | 87.60 / 6.28 |

<p class="small text-muted">Lower ECE is better. Bold indicates best-performing models within standard error.</p>

**100-client experiment — spread becomes critical.** When data is split across 100 clients (each client has far fewer samples), high-spread aggregations (EAA, PPA) collapse entirely, while low-spread methods (GAA, AALV, CF) continue to outperform deterministic baselines:

| Setting | FED | FVBA + EAA | FVBA + GAA | FVBA + AALV |
| :--- | :---: | :---: | :---: | :---: |
| Cifar-10 — IID (Acc) | 64.40 | 45.10 | **66.97** | **67.45** |
| SVHN — IID (Acc) | 87.20 | 79.51 | **90.16** | **90.10** |
| Cifar-10 — non-IID (Acc) | **61.23** | 26.87 | **60.85** | **60.60** |
| SVHN — non-IID (Acc) | 85.00 | 67.47 | **87.34** | **87.46** |

<p class="small text-muted">EAA collapses under 100-client non-IID (26.87% on Cifar-10 vs. 60.85% for GAA). GAA/AALV/CF match or surpass deterministic baselines while offering better calibration.</p>

**Key finding — degree of spread dominates.** Across all settings, the empirical standard deviation of the final aggregated model is the most consistent predictor of performance: high-spread methods (EAA, PPA) produce overconfident, poorly calibrated models under 100 clients, while low-spread methods (GAA, AALV, CF) learn stably. No single low-spread rule consistently beats the others in all scenarios.

**Calibration advantage of VBNNs.** When accuracy is competitive, VBNNs universally provide lower ECE and NLL than deterministic counterparts, confirming that probabilistic FL models are better suited for uncertainty-sensitive downstream use.

## Conclusion

- **First systematic study:** BFL is the first work to empirically investigate the effect of statistical aggregation rules on VBNNs in federated learning, filling a gap left by prior probabilistic FL methods that focus on convergence guarantees or personalization.
- **Spread is the dominant factor:** Aggregation methods that keep the variance of the global distribution low (GAA, AALV, CF) are consistently more stable, especially as the number of clients grows and local datasets shrink.
- **High-spread methods collapse at scale:** EAA and PPA maintain performance with 10 clients but degrade sharply under 100 clients, particularly in non-IID settings where local distributions are highly heterogeneous.
- **Better calibration without sacrificing accuracy:** Low-spread VBNN aggregations match or outperform deterministic FedAvg on accuracy while providing significantly lower calibration error (ECE) and negative log-likelihood.
- **Reproducible pipeline:** A parallelized multi-process simulation framework ([BFL-P](https://github.com/ituvisionlab/BFL-P)) is released, substantially reducing wall-clock training time and enabling full reproducibility.

---

## References

1. **Ozer, A., Buldu, K.B., Akgül, A., & Unal, G. (2022).** How to Combine Variational Bayesian Networks in Federated Learning. *NeurIPS 2022.* [github.com/ituvisionlab/BFL-P](https://github.com/ituvisionlab/BFL-P)
2. **McMahan, B., Moore, E., Ramage, D., Hampson, S., & Arcas, B.A.Y. (2017).** Communication-Efficient Learning of Deep Networks from Decentralized Data. *AISTATS 2017.*
3. **Li, T., Sahu, A.K., Zaheer, M., Sanjabi, M., Talwalkar, A., & Smith, V. (2020).** Federated Optimization in Heterogeneous Networks. *MLSys 2020.*
4. **Zhang, X., Li, Y., Li, W., Guo, K., & Shao, Y. (2022).** Personalized Federated Learning via Variational Bayesian Inference. *ICML 2022.*
5. **Al-Shedivat, M., Gillenwater, J., Xing, E., & Rostamizadeh, A. (2021).** Federated Learning via Posterior Averaging. *ICLR 2021.*
6. **Hill, T.P. (2008).** Conflations of Probability Distributions. *Transactions of the American Mathematical Society.*
7. **Blundell, C., Cornebise, J., Kavukcuoglu, K., & Wierstra, D. (2015).** Weight Uncertainty in Neural Networks. *ICML 2015.*
