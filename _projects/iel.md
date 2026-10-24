---
layout: project
title: "IEL: Hitting Time Isomorphism for Multi-Stage Planning"
description: "The first foundation policy method that is unsupervised, directional, and satisfies the triangle inequality. Beats HILP on all six D4RL AntMaze and Kitchen benchmarks (67.5 vs. 54.6 mean normalized return), with +98% on AntMaze-Ultra-Diverse. NeurIPS 2026."
img: assets/img/projects/iel_framework.png
importance: 4
category: Featured Work
venue: "NeurIPS"
year: 2026
role: "2nd Author"
bib_key: "boock2026hittingtime"
math: true
---

## Introduction

Large offline trajectory datasets have pushed reinforcement learning toward reward-free pretraining: learning a single **foundation policy** that reaches any goal zero-shot, without goal-conditioned rewards. For such a policy to solve long-horizon tasks, its state representation must support **multi-stage planning** through intermediate subgoals. **Isomorphic Embedding Learning (IEL)** builds this representation from **expected hitting times** (the expected number of steps to reach a goal), learning a directed latent geometry that is provably a linear transformation of the environment's true temporal structure.

*In this collaborative work (2nd author), I co-supervised the first author, a PhD student, mainly by helping with the experiments.*

## Problem Statement

A representation that supports multi-stage planning in a foundation policy must have three properties at once:

- **Unsupervised policy training:** the policy is learned without explicit goal-conditioned reward labels, so it generalizes to goals defined only at deployment.
- **Directional distances:** real environments are irreversible or reversible at asymmetric cost; routes planned with symmetric distances can pass through subgoals that cannot be reached in the required direction.
- **Triangle inequality:** local distances must compose into globally consistent plans through intermediate states never specified at training time.

| Method family | Directional | Triangle inequality | Unsupervised policy training |
| :--- | :---: | :---: | :---: |
| Successor measures (FB, CRL, PSM, CMD) | ✓ | only CMD | ✗ |
| Reachability distances (HIQL, QRL, TMD) | ✓ | QRL, TMD | ✗ |
| Hitting time (GAS, HILP) | ✗ | ✓ | only HILP |
| **IEL (this work)** | **✓** | **✓** | **✓** |

<p class="small text-muted">No prior method satisfies all three properties. HILP is the only existing foundation policy baseline, but its symmetric Euclidean features cannot capture directed dynamics.</p>

## Methodology

IEL works in an operator-theoretic framework: the environment is a Controlled Markov Process whose expected next-state features evolve (approximately) linearly in a Hilbert space $\mathcal{H}$. In this setting, the expected hitting time from state $x$ to goal $g$ under policy $\pi$ is exactly a **linear functional of the latent displacement**:

$$V^\pi(x, g) = \langle \phi(g) - \phi(x),\, \omega_g^\pi \rangle_{\mathcal{H}}$$

where $\phi$ is the state encoder and $\omega_g^\pi$ is a task identifier for reaching $g$.

**Theory:**
- **Existence:** the representation exists under latent linear closure and an adjoint range condition.
- **Identifiability:** any two representations that recover the same hitting times are related by a unique bounded linear isomorphism, so hitting-time readouts of the canonical dynamics can be recovered from the learned features.
- **Error bounds:** for finite-dimensional encoders, global hitting-time error is bounded by one-step transition error amplified by the transient spectral radius; finite-sample PAC guarantees cover approximation, statistical complexity, coverage, and trajectory-label mismatch.

**The IEL algorithm** has four components:
1. **Task identifier learning:** a contrastive (InfoNCE) objective learns an injective goal encoder $\omega_\psi(g)$ that defines the directional axis for each goal.
2. **Hitting-time regression:** intermediate trajectory states are relabeled as goals, and observed temporal gaps are regressed onto displacement scores using IQL-style expectile regression.
3. **Temporal difference learning:** a directional planning surrogate $\|\phi(g) - \phi(x)\| \exp\left(\beta(1 - \cos\xi)\right)$, a bounded upper envelope of the linear hitting-time increments, penalizes both distance and angular misalignment with the goal direction and supports trajectory stitching; $\beta = 0$ recovers HILP.
4. **Graph search for multi-stage planning:** a directed graph is built over a diverse coreset of offline latent states (DPP selection, MST backbone, $k$-NN edges) with the surrogate as asymmetric edge cost. Shortest-path closure yields a directed graph distance that satisfies the triangle inequality by construction, and shortest paths from the goal give a global navigation function for zero-shot planning.

{% include figure.liquid loading="eager" path="assets/img/projects/iel_framework.png" title="IEL Framework" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. Overview of IEL. Offline and reward-free, IEL learns a task identifier, regresses observed hitting times onto latent displacements, and stitches trajectories with TD learning on a directional surrogate. At test time, a directed graph over latent states turns these local predictions into zero-shot multi-stage plans via shortest-path search.
</div>

## Results

Evaluated on **six offline goal-conditioned benchmarks** from D4RL (AntMaze Large and Ultra, Franka Kitchen), with 8 seeds and 1M gradient steps, following HILP's experimental setup and hyperparameters:

| Dataset | GC-IQL | HILP (Rec-Mid) | HILP (Sym-Graph) | IEL (Sym-Graph) | IEL (Asym-Graph) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| antmaze-large-diverse | 56.0 ± 6.0 | 68.0 ± 6.3 | 60.5 ± 18.8 | 55.0 ± 20.6 | **71.8 ± 6.5** |
| antmaze-large-play | 56.0 ± 25.7 | 54.5 ± 11.9 | 45.5 ± 8.3 | **63.0 ± 14.9** | 62.8 ± 5.9 |
| antmaze-ultra-diverse | 40.8 ± 11.1 | 39.8 ± 22.1 | 68.8 ± 23.0 | 62.5 ± 18.7 | **79.0 ± 4.5** |
| antmaze-ultra-play | 41.8 ± 9.0 | 56.0 ± 18.9 | 60.2 ± 10.4 | 65.2 ± 13.5 | **73.8 ± 6.2** |
| kitchen-partial | 56.4 ± 8.4 | 55.4 ± 9.2 | 53.8 ± 8.1 | **60.4 ± 5.5** | **60.4 ± 3.5** |
| kitchen-mixed | **59.5 ± 3.8** | 53.7 ± 3.5 | 49.0 ± 4.6 | 57.8 ± 5.1 | 57.2 ± 3.8 |

<p class="small text-muted">Mean normalized return ± standard deviation. GC-IQL results are from HILP (Park et al., 2024). Rec-Mid: HILP's recursive midpoint planner. Sym-Graph / Asym-Graph: graph planning with symmetric / asymmetric distances.</p>

{% include figure.liquid loading="eager" path="assets/img/projects/iel_results.png" title="IEL vs. HILP" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 2. IEL with asymmetric graph planning outperforms HILP's original planner on all six benchmarks, with the largest gains on the long-horizon AntMaze-Ultra mazes (79.0 vs. 39.8 on ultra-diverse).
</div>

- **Graph planning works better with IEL embeddings:** with IEL embeddings, the symmetric graph planner beats recursive midpoint planning in five of six environments; with HILP embeddings, it does so in only two.
- **Directionality adds further gains:** asymmetric planning raises IEL's mean normalized return from 60.7 (Sym-Graph) to 67.5 (Asym-Graph), with the largest gains on AntMaze (+16.8 on large-diverse, +16.5 on ultra-diverse).
- **Consistent margin over HILP:** IEL (Asym-Graph) outperforms both HILP variants on all six benchmarks.

{% include figure.liquid loading="eager" path="assets/img/projects/iel_ablation.png" title="Planner ablation" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 3. Mean normalized return over the six benchmarks for each embedding and planner combination. Graph planning helps IEL embeddings much more than HILP embeddings (60.7 vs. 56.3), and directional edge costs add a further gain (67.5).
</div>
- **Negligible overhead:** IEL's training cost is nearly the same as HILP's, and asymmetric graph planning runs at a speed comparable to Rec-Mid.

## Conclusion

- **Directed temporal geometry:** IEL replaces symmetric distance heuristics with a hitting-time representation that captures both the direction and the scale of time.
- **Provable guarantees:** existence, identifiability up to a linear isomorphism, approximation bounds, and finite-sample PAC guarantees ground the learned geometry.
- **First to satisfy all three properties:** unsupervised policy training, directional distances, and the triangle inequality (through shortest-path closure of the planning graph), which together enable multi-stage planning in foundation policies.
- **State of the art among foundation policies** on offline maze locomotion, with the largest gains on the longest-horizon tasks.

---

## References

1. **Boock, M. V., Akgül, A., Çelikok, M. M., & Kandemir, M. (2026).** Hitting Time Isomorphism for Multi-Stage Planning with Foundation Policies. *NeurIPS 2026.* [arXiv:2605.06470](https://arxiv.org/abs/2605.06470)
2. **Park, S., Kreiman, T., & Levine, S. (2024).** Foundation Policies with Hilbert Representations. *ICML 2024.*
3. **Kostrikov, I., Nair, A., & Levine, S. (2022).** Offline Reinforcement Learning with Implicit Q-Learning. *ICLR 2022.*
4. **Fu, J., Kumar, A., Nachum, O., Tucker, G., & Levine, S. (2020).** D4RL: Datasets for Deep Data-Driven Reinforcement Learning. *arXiv:2004.07219.*
