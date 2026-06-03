---
layout: project
title: "CDDP: Continual Learning of Multi-modal Dynamics"
description: "Learns new dynamical modes sequentially without catastrophic forgetting or mode labels, outperforming parameter-transfer baselines on 4 out of 5 datasets. Neural episodic memory with a Dirichlet Process prior for automatic mode discovery. L4DC 2024."
img: assets/img/projects/cddp.png
importance: 4
category: Featured Work
venue: "L4DC"
year: 2024
role: "First Author"
bib_key: "akgul2024cddp"
---

## Introduction

No prior method could learn a dynamical system's behavioral modes sequentially without either catastrophically forgetting earlier ones or requiring explicit mode labels at test time — two constraints that the standard continual learning fix of parameter transfer (Variational Continual Learning) cannot simultaneously satisfy for multi-modal dynamics. **CDDP (Continual Dynamic Dirichlet Process)** solves both by replacing parameter transfer with a neural episodic memory and a Dirichlet Process prior on attention weights, enabling automatic mode discovery and zero-forgetting transfer within a Bayesian State-Space Model.

*This work was the second contribution of my [Master's thesis](/projects/mastersthesis/) at Istanbul Technical University, published at L4DC 2024.*

## Problem Statement

- **Bayesian State-Space Models (BSSMs)** can fit a single dynamical mode well but are not designed for continual multi-modal learning.
- The standard continual learning fix, **Variational Continual Learning (VCL)**, transfers posterior parameters from one task to the next as the new prior. For classification, this works; for dynamics, it fails because the shared parameter space cannot simultaneously represent modes with fundamentally different transition structures.
- VCL also requires knowing which mode is active at test time, a strong and often unrealistic assumption.
- **Catastrophic forgetting:** adapting to a new mode overwrites representations of earlier ones when only parameter transfer is used.
- **Gap:** No prior method handles continual learning of sequential tasks with unknown, multi-modal dynamics without explicit mode labels or per-task network heads.

## Methodology

CDDP augments a BSSM with two key components: a **neural episodic memory** of mode descriptors, and a **Dirichlet Process (DP) prior** on attention weights.

**Memory-gated transition kernel:** Given a context window of observations y_{1:C}, an encoder maps them to a query. Attention weights over R memory slots are computed via cosine similarity; the top-matching descriptor is retrieved and injected into the state transition kernel as an additional input, with no parameter transfer between tasks.

$$w_r(y_{1:C}, m_r) = \frac{e^{\langle m_r,\, e_\lambda(y_{1:C}) \rangle}}{\sum_{j=1}^{R} e^{\langle m_j,\, e_\lambda(y_{1:C}) \rangle}}$$

After observing a new task, memory is updated by a convex interpolation: high-similarity slots absorb the new mode; low-similarity slots are left largely unchanged, **preserving old knowledge without parameter transfer**.

**Dirichlet Process prior (automatic mode discovery):** The mixture weight π follows a GEM (stick-breaking) distribution with concentration α₀. Small α₀ concentrates mass on a few slots; large α₀ spreads mass broadly. The model never needs to be told how many modes exist.

{% include figure.liquid loading="eager" path="assets/img/projects/cddp_fig1.png" title="CDDP Overview" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. CDDP overview. During inference, the context sequence y<sub>1:C</sub> is encoded and matched against stored memory descriptors via cosine similarity. The Dirichlet Process prior induces a sparse attention distribution over R memory slots. The retrieved descriptor is injected into the transition kernel to predict y<sub>C+1:T</sub>. Memory slots are updated online, with no parameter transfer between tasks.
</div>

<div class="row justify-content-center">
<div class="col-sm-10">
{% include figure.liquid loading="eager" path="assets/img/projects/cddp_plate.png" title="CDDP plate diagram" class="img-fluid rounded z-depth-1" %}
</div>
</div>
<div class="caption">
  Figure 2. Graphical model of CDDP. Left: R memory slots and their attention weights. Center: context observations encoded and matched to memory; the Dirichlet Process–weighted descriptor initializes the latent state. Right: the latent chain propagates forward and emits predictions y<sub>C+1:T</sub>.
</div>

**Training:** the variational objective (ELBO) includes a KL term that aligns learned attention weights with the DP prior, encouraging sparse and interpretable mode assignments.

## Results

Evaluated on **3 synthetic** and **2 real-world** multi-modal trajectory datasets, each structured as a continual learning sequence. The model sees tasks one at a time; no mode labels are given at test time.

### Datasets

These datasets are not standard ML benchmarks; they are drawn from dynamical systems and human motion capture, each presenting a distinct type of multi-modal behavior:

**Sine Waves** — 1D oscillations $y_t = A\sin(2\pi f t)$ with 5 amplitude levels $A \in \{3,6,9,12,15\}$ and 3 frequency levels $f \in \{\tfrac{2}{3}, 1, \tfrac{4}{3}\}$, yielding 15 modes across 5 tasks. The simplest benchmark; modes differ in scale and oscillation rate.

**Lotka-Volterra** — classic predator-prey ordinary differential equation (ODE):

$$\frac{dx_t}{dt} = \alpha x_t - \beta x_t y_t, \qquad \frac{dy_t}{dt} = \delta x_t y_t - \gamma y_t$$

Eight modes generated by varying the biological parameters $(\alpha, \beta, \gamma, \delta)$ across 4 tasks. Sequence length 25, step size Δt = 0.4. Each mode produces qualitatively different oscillatory dynamics between prey (x) and predator (y) populations.

**Lorenz Attractor** — chaotic 3D system with sensitive dependence on initial conditions:

$$\frac{dx_t}{dt} = \sigma(y_t - x_t), \qquad \frac{dy_t}{dt} = x_t(\rho - z_t) - y_t, \qquad \frac{dz_t}{dt} = x_t y_t - \beta z_t$$

Twelve modes from different parameter triples $(\sigma, \rho, \beta)$ across 4 tasks. Sequence length 50, step size Δt = 0.01. This is the hardest synthetic benchmark: neighboring trajectories diverge exponentially, making mode identification from a short context window especially challenging.

{% include figure.liquid loading="eager" path="assets/img/projects/cddp_dataset.png" title="Synthetic datasets" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 3. Examples from the three synthetic datasets. Left: Sine Waves with different amplitude/frequency combinations (1D). Center: Lotka-Volterra predator-prey trajectories showing distinct oscillation cycles for different parameter settings (2D). Right: Lorenz Attractor chaotic trajectories projected from 3D, where each color corresponds to a different parameter mode.
</div>

**Libras Movement** — 2D hand-movement trajectories from 15 classes of Brazilian Sign Language (LIBRAS), captured via video at 45 frames per sequence. 5 tasks, 15 modes, 180 train / 180 test sequences. Modes correspond to distinct sign gestures with different spatial extents and trajectories.

**Character Trajectories** — 3-attribute stylus-pen trajectories (x position, y position, pen tip force) for 20 English characters, subsampled to length 109. 5 tasks, 20 modes, 1422 train / 1436 test sequences. The most challenging real-world dataset: 20 distinct character shapes with shared stroke primitives require fine-grained mode discrimination.

<div class="row">
  <div class="col-sm-6">
    {% include figure.liquid loading="eager" path="assets/img/projects/cddp_libras.jpg" title="Libras Movement Dataset" class="img-fluid rounded z-depth-1" %}
  </div>
  <div class="col-sm-6">
    {% include figure.liquid loading="eager" path="assets/img/projects/cddp_ct.jpg" title="Character Trajectories Dataset" class="img-fluid rounded z-depth-1" %}
  </div>
</div>
<div class="caption">
  Figure 4. Real-world datasets. Left: hand-movement trajectories from the Libras dataset (Brazilian Sign Language), with each panel showing a different sign class. Right: stylus-pen character trajectories for selected English alphabet letters; modes correspond to distinct characters whose strokes share low-level primitives.
</div>

**Dataset summary:**

| Type | Dataset | Tasks | Modes | Seq. Length | Attributes |
| :--- | :--- | :---: | :---: | :---: | :---: |
| Synthetic | Sine Waves | 5 | 15 | 15 | 1 |
| Synthetic | Lotka-Volterra | 4 | 8 | 25 | 2 |
| Synthetic | Lorenz Attractor | 4 | 12 | 50 | 3 |
| Real-world | Libras | 5 | 15 | 45 | 2 |
| Real-world | Character Trajectories | 5 | 20 | 109 | 3 |

### Quantitative Results

**Metrics:** AUC of NMSE and NLL plotted against tasks learned, averaged over 10 repetitions. Lower is better for both.
- **NMSE** (Normalized MSE): prediction error relative to signal magnitude
- **NLL** (Negative Log-Likelihood): calibration quality of the predictive distribution

**Main results** — AUC NMSE ↓ and AUC NLL ↓ (mean ± SE, 10 seeds). Lower is better.

| Dataset | VCL-BSSM NMSE | CDDP NMSE | VCL-BSSM NLL | CDDP NLL |
| :--- | :---: | :---: | :---: | :---: |
| Sine Waves | 1.00 ± 0.04 | **0.91 ± 0.03** | 3.57 ± 0.09 | **3.50 ± 0.09** |
| Lotka-Volterra | **0.58 ± 0.04** | 0.60 ± 0.06 | 1.50 ± 0.05 | **1.32 ± 0.08** |
| Lorenz Attractor | 0.26 ± 0.00 | **0.24 ± 0.01** | 4.42 ± 0.04 | **4.35 ± 0.06** |
| Libras | **0.14 ± 0.00** | **0.14 ± 0.00** | -0.37 ± 0.02 | **-0.39 ± 0.04** |
| Character Trajectories | 0.87 ± 0.04 | **0.64 ± 0.01** | 0.14 ± 0.02 | **-0.19 ± 0.03** |

<p class="small text-muted">CDDP wins 4/5 on NMSE and 5/5 on NLL. Largest gain on Character Trajectories: −26% NMSE, NLL drops from 0.14 to −0.19 (better calibration).</p>

{% include figure.liquid loading="eager" path="assets/img/projects/cddp_predictions.png" title="CDDP character trajectory predictions" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 3. CDDP predictions on Character Trajectories. Black = context window y<sub>1:C</sub> (observed); colored = prediction y<sub>C+1:T</sub>. CDDP correctly identifies the character mode from the short context and produces accurate trajectories across all 20 classes, without being told which character is being written.
</div>

**Ablation on Sine Waves** confirms that both learned memory content and the absence of parameter transfer are necessary for best performance. Fixed-initialization variants degrade monotonically with initialization magnitude; adding parameter transfer to CDDP does not help and slightly hurts NLL.

## Conclusion

- **First study** on continual learning of multi-modal dynamical systems, introducing both the problem formulation and the associated continual learning risk objective.
- **VCL-BSSM** introduced as a strong parameter-transfer baseline for practitioners adapting continual classification methods to dynamics.
- **Memory beats parameter transfer:** CDDP outperforms VCL-BSSM in 4/5 datasets on NMSE and 5/5 on NLL; memory preserves structure that shared parameters cannot represent simultaneously.
- **No mode labels required:** the DP prior discovers the number of active modes automatically from data.
- **Broad applicability:** the framework applies directly to weather forecasting (features transferred across climates), autonomous driving (adapting across countries), and model-based RL (handling environment changes from agent actions or external factors).

---

## References

1. **Akgül, A., Unal, G., & Kandemir, M. (2024).** Continual Learning of Multi-modal Dynamics with External Memory. *Proceedings of the 6th Annual Learning for Dynamics and Control Conference (L4DC 2024).* [arXiv:2203.00936](https://arxiv.org/abs/2203.00936)
2. **Nguyen, C. V., Li, Y., Bui, T. D., & Turner, R. E. (2018).** Variational Continual Learning. *ICLR 2018.*
3. **Rangapuram, S. S., et al. (2018).** Deep State Space Models for Time Series Forecasting. *NeurIPS 2018.*
4. **Sethuraman, J. (1994).** A constructive definition of Dirichlet priors. *Statistica Sinica.*
5. **Graves, A., Wayne, G., & Danihelka, I. (2014).** Neural Turing Machines. *arXiv:1410.5401.*
6. **Kirkpatrick, J., et al. (2017).** Overcoming catastrophic forgetting in neural networks. *PNAS.*
