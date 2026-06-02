---
layout: project
title: "EPPO: Evidential Proximal Policy Optimization"
description: "Evidential uncertainty quantification in the critic network preserves plasticity and enables directed exploration, outperforming state-of-the-art on-policy methods in non-stationary environments. Published in TMLR 2025."
img: assets/img/projects/eppo.png
importance: 3
category: Featured Work
venue: "TMLR"
year: 2025
bib_key: "akgul2025overcoming"
---

## Introduction

Real-world control systems face continuously changing dynamics: robot joints wear and lose torque, terrain friction shifts underfoot, payloads change mid-task. On-policy RL methods like PPO are natural fits (they discard old data and learn only from fresh transitions) but fail in practice under non-stationarity. **Evidential Proximal Policy Optimization (EPPO)** integrates evidential deep learning into the PPO critic to simultaneously preserve the network's capacity to learn (plasticity) and direct exploration toward regions where dynamics have changed, from a single probabilistic framework.

## Problem Statement

Two compounding problems prevent PPO from adapting to non-stationary environments:

- **Loss of plasticity:** Over long non-stationary training runs, critic neurons gradually saturate or go dormant. The network structurally loses the ability to update even when new data arrives. Prior plasticity fixes (PFO, CB) prevent saturation through regularization or reinitialization but provide no signal about *where* dynamics have changed.
- **Undirected exploration:** When dynamics change, the agent should actively probe the altered regions of the state space. Without a targeted uncertainty signal, exploration stays uniform and samples are wasted. Prior exploration methods (PPO_DRND) add a curiosity bonus but do nothing about plasticity.
- **Neither fix alone is sufficient:** Experiments confirm that approaches addressing only one challenge fall short; both must be solved simultaneously.
- **Gap:** No existing on-policy method provides a unified mechanism that quantifies value-function uncertainty to preserve plasticity *and* direct exploration under non-stationarity.

## Methodology

EPPO replaces the scalar PPO critic with an **evidential critic**, a network outputting Normal-Inverse-Gamma (NIG) parameters (ω, ν, α, β) for each state, placing a full distribution over the value:

$$(\mu, \sigma^2) \mid s \;\sim\; \mathrm{NIG}\!\left(\omega(s),\, \nu(s),\, \alpha(s),\, \beta(s)\right)$$

This gives two types of uncertainty analytically:
- **Aleatoric uncertainty** β/(α−1): irreducible noise from the environment's stochasticity
- **Epistemic uncertainty** β/[ν(α−1)]: reducible uncertainty from limited data; **spikes when dynamics shift**

<div class="row justify-content-center">
<div class="col-sm-6">
{% include figure.liquid loading="eager" path="assets/img/projects/eppo_plate.png" title="Evidential value learning generative model" class="img-fluid rounded z-depth-1" %}
</div>
</div>
<div class="caption">
  Figure 1. Generative model of EPPO's evidential critic. The state s determines the NIG hyperpriors (ω, ν, α, β) via a neural network. These parameterize a Normal-Inverse-Gamma prior over (μ, σ²), which governs the value prediction V. Marginalizing out (μ, σ²) yields a Student-t marginal likelihood used as the training objective.
</div>

**Plasticity via adaptive gradient scaling.** The evidential NLL loss contains an adaptive factor ζ that automatically dampens updates when approximation error Δ = |V − target| is large, preventing the runaway weight changes that saturate neurons and create dormant units.

**Directed exploration via UCB advantages.** Modeling V as a distribution transforms the Generalized Advantage Estimator (GAE) into a random variable. An Upper Confidence Bound converts this into directed exploration:

$$\hat{A}_t^{\text{UCB}} = \mathbb{E}[\hat{A}_t^{\text{GAE}}] + \kappa\,\sqrt{\mathrm{Var}[\hat{A}_t^{\text{GAE}}]}$$

Two variants differ in how GAE variance is derived:
- **EPPO_cor** — propagates correlated uncertainties across the rollout
- **EPPO_ind** — treats k-step advantage estimators as independent, making it more far-sighted for the same κ

**Benchmark settings (novel contribution: Paralysis):** EPPO introduces a challenging paralysis benchmark where specific leg joints have their torque progressively reduced to 0% and then fully restored [100→75→50→25→0→25→50→75→100]%, with 10 schemes across Ant-v5 and HalfCheetah-v5. No task identifiers are provided.

## Results

**Environments:** Ant-v5 and HalfCheetah-v5 (MuJoCo Gymnasium v5), 500K steps per sub-task, **15 random seeds**.

**Metrics:** AULC (area under the learning curve, covering adaptation speed and sustained performance) and Final Return.

**Baselines:** PPO (foundation), PFO (plasticity via feature constraint), CB (continual backpropagation [[Dohare et al., Nature 2024]](https://www.nature.com/articles/s41586-024-07711-7)), PPO_DRND (exploration [[Yang et al., ICML 2024]](https://arxiv.org/abs/2401.09750)). **EPPO_mean** (κ=0) isolates the plasticity benefit from the exploration benefit.

{% include figure.liquid loading="eager" path="assets/img/projects/eppo_intro_fig.png" title="EPPO vs baselines on HalfCheetah paralysis" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 2. Episode return throughout training on HalfCheetah-v5 with progressive front-joint paralysis. Vertical dashed lines mark task changes. PPO and PFO plateau early and fail to recover. PPO_DRND gains some adaptability but degrades over time. EPPO variants continue to improve and maintain high performance across the entire training horizon.
</div>

**Slippery environments** (friction varied 0.5–4.0, 15 sub-tasks, averaged over 4 settings):

| Model | Avg AULC | AULC rank | Avg Final Return | Final rank |
| :--- | :---: | :---: | :---: | :---: |
| PPO | 2406 | 5.3 | 2475 | 5.5 |
| PFO | 2279 | 5.0 | 2371 | 5.3 |
| CB | 1956 | 6.5 | 2037 | 6.5 |
| PPO_DRND | 2359 | 4.5 | 2449 | 4.5 |
| EPPO_mean | 2658 | 3.5 | 2790 | 3.0 |
| EPPO_cor | **2962** | **1.5** | **3120** | **1.5** |
| EPPO_ind | 2908 | 1.8 | 3053 | 1.8 |

**Paralysis environments** (overall average, 10 schemes, 6 Ant + 4 HalfCheetah):

| Model | Avg AULC | AULC rank | Avg Final Return | Final rank |
| :--- | :---: | :---: | :---: | :---: |
| PPO | 2133 | 5.9 | 2310 | 5.8 |
| PFO | 2184 | 5.2 | 2376 | 5.3 |
| CB | 2091 | 6.2 | 2248 | 6.4 |
| PPO_DRND | 2343 | 3.8 | 2547 | 3.9 |
| EPPO_mean | 2643 | 3.1 | 2881 | 3.9 |
| EPPO_cor | 2781 | 2.1 | 3039 | 1.9 |
| EPPO_ind | **2828** | **1.7** | **3074** | **1.7** |

<p class="small text-muted">Rank 1 = best. Lower is better.</p>

**Plasticity analysis** confirms EPPO variants maintain higher effective rank, higher stable rank, and fewer dormant units than all baselines throughout training (p < 0.05, one-sided paired t-test):

{% include figure.liquid loading="eager" path="assets/img/projects/eppo_plasticity.png" title="Plasticity preservation analysis" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 3. Plasticity metrics on slippery environments (box plots, 15 seeds × 4 settings). From left to right: effective rank, stable rank, and dormant unit percentage measured at the end of every sub-task. EPPO variants (orange/red) maintain higher ranks and fewer dormant units than all baselines, confirming evidential value learning preserves the critic's representational capacity.
</div>

## Conclusion

- **Joint solution is necessary:** Baselines addressing only plasticity (PFO, CB) or only exploration (PPO_DRND) both underperform; EPPO's unified probabilistic framework is what enables consistent adaptation.
- **Evidential value learning preserves plasticity:** Higher effective rank, stable rank, and fewer dormant neurons compared to all baselines, verified across 15 seeds and two benchmark types.
- **UCB exploration amplifies gains:** The exploration bonus guides the agent toward states where dynamics have shifted (+42–44% AULC on HalfCheetah paralysis schemes vs. next-best baseline).
- **Novel benchmark:** The Paralysis environment (progressive joint torque reduction) provides a harder and more realistic non-stationarity test than standard friction-varying benchmarks.
- **State-of-the-art on both metrics:** Best AULC rank of 1.5 on slippery and 1.7 on paralysis environments, averaged across 10+ non-stationary scenarios.

---

## References

1. **Akgül, A., Baykal, G., Haußmann, M., & Kandemir, M. (2025).** Overcoming Non-stationary Dynamics with Evidential Proximal Policy Optimization. *Transactions on Machine Learning Research (TMLR).* [arXiv:2503.01468](https://arxiv.org/abs/2503.01468)
2. **Schulman, J., Wolski, F., Dhariwal, P., Radford, A., & Klimov, O. (2017).** Proximal Policy Optimization Algorithms. *arXiv:1707.06347.*
3. **Schulman, J., Moritz, P., Levine, S., Jordan, M., & Abbeel, P. (2015).** High-Dimensional Continuous Control Using Generalized Advantage Estimation. *ICLR 2016.*
4. **Amini, A., Schwarting, W., Soleimany, A., & Rus, D. (2020).** Deep Evidential Regression. *NeurIPS 2020.*
5. **Dohare, S., et al. (2024).** Loss of Plasticity in Deep Continual Learning. *Nature.*
6. **Yang, K., et al. (2024).** Exploration and Anti-Exploration with Distributional Random Network Distillation. *ICML 2024.*
7. **Todorov, E., Erez, T., & Tassa, Y. (2012).** MuJoCo: A physics engine for model-based control. *IROS 2012.*
