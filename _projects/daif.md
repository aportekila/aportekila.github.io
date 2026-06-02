---
layout: project
title: "Distributional Active Inference"
description: "A unified framework bridging distributional reinforcement learning and active inference, enabling sample-efficient control without modeling transition dynamics. Published at ICML 2026."
img: assets/img/projects/daif_fig1.png
importance: 1
category: Featured Work
venue: "ICML"
year: 2026
bib_key: "akgul2026distributional"
---

## Introduction

Effective autonomous control requires two complementary capabilities: organizing raw sensory observations into compact state representations, and planning action sequences that maximize long-term reward. Reinforcement learning (RL) excels at planning but treats exploration as a secondary concern. Active Inference provides both capabilities through free-energy minimization, but prior implementations require expensive learned world models. **Distributional Active Inference (DAIF)** bridges this gap, delivering principled uncertainty-driven exploration and full return-distribution estimation in a purely model-free framework.

## Problem Statement

- **RL** handles the planning side but lacks principled uncertainty quantification for exploration; standard methods add entropy bonuses or random noise without formal grounding.
- **Active Inference** provides a unified account of perception and action, but existing RL applications require a transition dynamics model, adding overhead and instability.
- **Distributional RL** (QR-DQN, IQN) tracks return distributions but does not connect uncertainty over returns to exploration; the uncertainty is computed but not acted upon.
- **Gap:** No prior method jointly delivers (1) model-free operation, (2) distributional return estimation with epistemic uncertainty, and (3) exploration driven by Expected Free Energy minimization from a single coherent framework.

## Methodology

DAIF formulates quantile regression as **Bayesian quantile regression** under a Normal-Inverse-Gamma (NIG) generative model. For each (state, action, quantile) triple, a neural network outputs NIG parameters (μ, α, β), parameterizing a distribution over the quantile location and its scale:

$$\sigma \sim \mathrm{InvGam}(\alpha, \beta), \qquad G \mid \mu, \sigma, \tau \sim \mathrm{ALD}(\mu, \sigma, \tau)$$

Marginalizing out (μ, σ) yields a **closed-form training objective** (no Monte Carlo sampling). The Inverse-Gamma scale captures epistemic uncertainty; minimizing the Expected Free Energy (EFE) reduces to a distributional Bellman update with an intrinsic uncertainty-driven exploration bonus, with no world model required.

{% include figure.liquid loading="eager" path="assets/img/projects/daif_fig1.png" title="DAIF Framework" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. DAIF unifies Active Inference (state abstraction via encoder) and distributional RL (return distribution tracking). The encoder maps an equivalence class of observations to a latent state; an evidential network tracks the full return distribution as negative free energy; the Expected Free Energy (EFE) drives principled exploration without a transition dynamics model.
</div>

<div class="row justify-content-center">
<div class="col-sm-4">
{% include figure.liquid loading="eager" path="assets/img/projects/daif_plate.png" title="DAIF generative model" class="img-fluid rounded z-depth-1" %}
</div>
</div>
<div class="caption">
  Figure 2. Generative model of DAIF. The input triple <em>(s, a, τ)</em> determines the NIG hyperparameters (α, β) and location mean μ. These parameterize an Inverse-Gamma prior over the scale σ, which together with μ governs the observed return <em>G</em> through an Asymmetric Laplace Distribution. Marginalizing out (μ, σ) yields a closed-form objective, with no world model required.
</div>

**Key design choices:**
- Critic trained by minimizing the negative log marginal likelihood of the ALD (closed-form, no sampling noise)
- TD3-style delayed policy updates and target smoothing for training stability (following DSAC [[Ma et al., 2020]](https://arxiv.org/abs/2004.14547))
- Two-critic architecture: quantile mean predictions averaged across both critics to reduce overestimation bias
- Baselines: DRND, DSAC, DTD3 (distributional TD3), DrQ-v2 (pixel specialist)

## Results

Evaluated across **19 continuous control tasks** from three benchmark suites (10 seeds for EvoGym/DMC, 5 seeds for DMC Vision):

- **EvoGym** — 7 morphologically diverse soft-robot locomotion and manipulation tasks [[Bhatia et al., NeurIPS 2021]](https://evolutiongym.github.io/)
- **DMC** — 7 physics-based tasks from the DeepMind Control Suite with low-dimensional state observations [[Tunyasuvunakool et al., SoftwareX 2020]](https://github.com/deepmind/dm_control)
- **DMC Vision** — 5 DMC tasks with raw pixel observations only

DAIF achieves the **best average ranking** on both sample efficiency (AULC) and final performance across all three suites:

| Suite | Tasks | AULC rank | Final rank |
| :--- | :---: | :---: | :---: |
| EvoGym (soft robots) | 7 | **1.5 ± 0.7** | **1.6 ± 0.8** |
| DMC (state obs.) | 7 | **1.6 ± 0.7** | **1.5 ± 0.8** |
| DMC Vision (pixels) | 5 | **1.9 ± 1.2** | **2.0 ± 1.4** |

<p class="small text-muted">Rank 1 = best. Lower is better.</p>

Selected improvements over the next-best baseline (AULC metric):

| Task | DAIF AULC | Next best | Improvement |
| :--- | :---: | :---: | :---: |
| EvoGym — Upstepper | **5.56 ± 0.77** | 3.44 ± 0.92 (DTD3) | +62% |
| EvoGym — BidirectionalWalker | **7.21 ± 0.55** | 4.68 ± 0.86 (DSAC) | +54% |
| DMC — Dog-Run | **214 ± 31** | 162 ± 16 (DTD3) | +32% |
| DMC — Dog-Trot | **369 ± 79** | 313 ± 29 (DTD3) | +18% |
| DMC Vision — Walker-Run | **660 ± 6** | 588 ± 42 (DTD3) | +12% |
| DMC Vision — Quadruped-Run | **676 ± 18** | 614 ± 44 (DTD3) | +10% |

{% include figure.liquid loading="eager" path="assets/img/projects/daif_envs.png" title="Benchmark Environments" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 3. Representative benchmark environments. Left: EvoGym Catcher-v0 (soft robot catching falling objects). Center: DMC Dog-Run (high-DoF locomotion from state observations). Right: DMC Vision Quadruped-Run (locomotion from pixels only).
</div>

## Conclusion

- **Unified framework:** DAIF provides the first measure-theoretic integration of model-free, distributional, and Active Inference RL.
- **No world model needed:** Active Inference's exploration benefits transfer to model-free settings via distributional Bellman updates with NIG uncertainty.
- **Consistent state-of-the-art:** Best average rank across all 19 tasks on three benchmark suites, with especially large gains on challenging locomotion (+62% on EvoGym Upstepper, +32% on DMC Dog-Run).
- **Pixel-ready:** Competitive ranking on DMC Vision without pixel-specialist tuning, confirming generality of the approach.
- **Practical:** Two-critic NIG architecture adds minimal overhead compared to standard distributional RL baselines.

---

## References

1. **Akgül, A., Baykal, G., Haußmann, M., Çelikok, M. M., & Kandemir, M. (2026).** Distributional Active Inference. *ICML 2026.* [arXiv:2601.20985](https://arxiv.org/abs/2601.20985)
2. **Dabney, W., Rowland, M., Bellemare, M. G., & Munos, R. (2018).** Distributional Reinforcement Learning with Quantile Regression. *AAAI 2018.*
3. **Dabney, W., Ostrovski, G., Silver, D., & Munos, R. (2018).** Implicit Quantile Networks for Distributional Reinforcement Learning. *ICML 2018.*
4. **Friston, K. J., et al. (2017).** Active Inference: A Process Theory. *Neural Computation, 29(1).*
5. **Tunyasuvunakool, S., et al. (2020).** dm\_control: Software package for physics-based simulation and reinforcement learning. *SoftwareX.*
6. **Bhatia, J., et al. (2021).** Evolution Gym: A Large-Scale Benchmark for Evolving Soft Robots. *NeurIPS 2021.*
