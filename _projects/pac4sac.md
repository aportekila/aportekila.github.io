---
layout: project
title: "PAC4SAC: PAC-Bayesian Soft Actor-Critic Learning"
description: "2-3x sample efficiency improvement on high-dimensional tasks (Ant), best cumulative regret across all four PyBullet environments. First actor-critic using a PAC-Bayesian generalization bound as the critic training objective. AABI 2024."
img: assets/img/projects/pac4sac_fig1.png
importance: 7
category: Featured Work
venue: "AABI"
year: 2024
topic: "Value Estimation"
role: "2nd Author"
bib_key: "bahareh2024pac4sac"
---

## Introduction

No prior actor-critic algorithm had used a PAC-Bayesian generalization bound as its critic training objective — despite the theory offering exactly the worst-case guarantees that critic training needs. Standard actor-critic methods minimize plain Bellman error, which provides no guarantee on how well the critic generalizes to unseen states, allowing estimation errors to accumulate and destabilize training.

**PAC4SAC** (PAC-Bayes for Soft Actor-Critic) closes this gap by training a single randomized critic against a formal generalization bound, yielding three complementary properties in one loss: Bellman consistency, conservative value updates that eliminate overestimation without a second critic, and a principled exploration bonus that emerges from first principles rather than being added manually. A companion technique, **critic-guided multiple shooting**, leverages the randomized critic to search for better actions at interaction time, amplifying sample efficiency further.

*In this work (2nd author), I co-designed the algorithm, designed and ran all experiments, and contributed substantially to the writing.*

## Problem Statement

- **Value overestimation bias:** When the same network computes both the prediction and its training target, the Q-learning update systematically overestimates values; even for zero-mean noise, the maximum of noisy estimates is larger than the true maximum (Thrun & Schwartz, 1993). Using two critics to counteract this introduces an underestimation bias instead ([Fujimoto et al., TD3, 2018](https://arxiv.org/abs/1802.09477)).
- **Catastrophic interference:** Updating the critic to fix poorly-estimated states inevitably degrades already-accurate estimates for other states. Polyak averaging (slow target updates) mitigates but does not eliminate this effect.
- **Sample inefficiency:** The combined effect of estimation errors and interference forces modern actor-critic methods (SAC, DDPG) to interact with the environment for many more steps than necessary before finding a good policy.
- **Gap:** No prior work uses a PAC-Bayesian bound as the critic training objective in an actor-critic algorithm, despite the theory offering exactly the kind of worst-case generalization guarantees that critic training needs.

## Methodology

PAC4SAC makes two key contributions, illustrated in Figure 1.

{% include figure.liquid loading="eager" path="assets/img/projects/pac4sac_fig1.png" title="PAC4SAC Framework" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. The PAC4SAC framework. <em>Left:</em> The PAC-Bayesian critic loss has three interpretable terms: Bellman consistency (accurate value estimation), conservative value update (KL regularization prevents overestimation), and an exploration bonus (variance of next-state value, derived from first principles). Training this loss yields a critic with Gaussian-distributed output layer weights, i.e., a distribution over Q-values. <em>Right:</em> Multiple shooting uses this randomized critic at action-selection time: S candidate actions are sampled from the stochastic actor, each evaluated by a fresh critic sample, and the action with the highest sampled Q-value is executed.
</div>

### 1: PAC-Bayesian Critic Training

PAC4SAC treats the critic as a **Bayesian posterior** over Q-functions: the final linear layer has normally distributed weights, making every forward pass a random sample from a distribution over value estimates. The training objective minimizes a PAC-Bayesian generalization bound on Bellman error, adapted from [McAllester (1999)](https://link.springer.com/chapter/10.1007/3-540-45435-7_5) and the RL-specific bound of [Fard et al. (2012)](https://arxiv.org/abs/1206.1839), producing three complementary terms:

$$\mathcal{L}_\text{PAC}(\phi) :=
\underbrace{\mathbb{E}[R_N(\mu)]}_{\text{Bellman consistency}}
+ \underbrace{\sqrt{\frac{D_\text{KL}(\mu\,\|\,\mu_0)}{N}}}_{\text{conservative value update}}
- \xi\,\underbrace{\mathbb{E}\!\left[\mathrm{var}\!\left[\mathbb{E}[Q_\pi(s',a')]\right]\right]}_{\text{exploration}}$$

- **Bellman consistency** encourages accurate policy evaluation, as in standard SAC.
- **Conservative value update** (KL divergence between the learned posterior and a standard-normal prior) penalizes overconfident value estimates, replacing the need for a second critic to combat overestimation.
- **Exploration** maximizes the expected variance of the next-state value, promoting the agent to visit uncertain states. Crucially, this term emerges **from first principles** out of the PAC-Bayes bound, unlike the manually added entropy term in SAC.

The KL term and the variance term are both analytically tractable given a Gaussian penultimate layer, so no Monte Carlo sampling is needed during training.

### 2: Critic-Guided Optimal Action Search (Multiple Shooting)

At each environment interaction, the agent draws S candidate actions $a_1, \ldots, a_S$ from the stochastic actor and evaluates each with an independent sample from the critic distribution $Q^{\tilde{\theta}_i}(s, a_i)$. The action with the highest sampled Q-value is executed:

$$a_* = \arg\max_{i=1,\ldots,S}\, Q^{\tilde{\theta}_i}(s,\, a_i)$$

This **multiple shooting** strategy turns the critic's randomness into a directed search: the stochastic actor explores broadly, and the stochastic critic selects the most promising candidate without over-exploiting a potentially biased deterministic estimate. A convergence proof (Theorem 2 in the paper) shows that policy improvement holds for any sample count $S > 0$.

**Implementation:** PyTorch 1.13.1 · PyBullet Gymperium · Adam optimizer (lr = 0.001) · replay buffer of 25,000 · batch size 32 · $\xi = 0.01$ · $S = 500$ shooting samples.

## Results

Evaluated on four continuous control tasks from the **PyBullet Gymperium** suite ([Coumans & Bai, 2019](https://pybullet.org); [Benelot, 2018](https://github.com/benelot/pybullet-gym)) with increasing difficulty: Cartpole Swingup ($d_s=5, d_a=1$), Half Cheetah ($d_s=17, d_a=6$), Ant ($d_s=111, d_a=11$), and Humanoid ($d_s=376, d_a=17$). Baselines: SAC ([Haarnoja et al., 2018](https://arxiv.org/abs/1801.01290)), DDPG ([Lillicrap et al., 2015](https://arxiv.org/abs/1509.02971)), OAC ([Ciosek et al., 2019](https://arxiv.org/abs/1910.12807)). All results averaged over 5 seeds.

**Two metrics:** (1) **Cumulative Regret**: total reward gap relative to a task-completion threshold, measuring how efficiently the agent solves the task; (2) **Episodes Until Task Solved**: how quickly the agent first crosses the threshold consistently, measuring sample efficiency.

### Cumulative Regret (×10³) — lower is better

| Method | Cartpole Swingup | Half Cheetah | Ant | Humanoid |
| :--- | :---: | :---: | :---: | :---: |
| DDPG | 7.2 ± 1.0 | 317.8 ± 24.0 | 210.8 ± 21.2 | 906.2 ± 7.8 |
| SAC | 6.5 ± 0.3 | 166.8 ± 10.4 | 165.5 ± 17.0 | 539.0 ± 20.0 |
| OAC | 22.7 ± 1.4 | 213.0 ± 15.5 | 443.8 ± 128.3 | 1223.7 ± 44.5 |
| **PAC4SAC (Ours)** | **5.7 ± 0.3** | **132.8 ± 10.8** | **113.3 ± 10.9** | **528.8 ± 36.5** |

<p class="small text-muted">Mean ± std over 5 seeds. Bold = lowest mean.</p>

### Episodes Until Task Solved — lower is better

| Method | Cartpole (max 40) | Half Cheetah (max 250) | Ant (max 500) | Humanoid (max 500) |
| :--- | :---: | :---: | :---: | :---: |
| DDPG | 34.2 ± 3.8 | 250.0 ± 0.0 | 298.6 ± 56.4 | 500.0 ± 0.0 |
| SAC | 24.4 ± 5.7 | 250.0 ± 0.0 | 302.0 ± 44.8 | 482.2 ± 15.9 |
| OAC | 40.0 ± 0.0 | 250.0 ± 0.0 | 315.0 ± 82.6 | 500.0 ± 0.0 |
| **PAC4SAC (Ours)** | **22.0 ± 5.1** | **223.6 ± 14.6** | **146.4 ± 12.3** | **473.8 ± 18.5** |

PAC4SAC achieves the best result on every task in both metrics. The improvement is most dramatic on **Ant**, where PAC4SAC solves the task in 146 episodes versus 298–443 for the baselines, a 2–3× sample efficiency gain.

### Ablation: All Three Loss Terms Matter

| Bellman | Conservative | Exploration | Cartpole Regret (×10³) | Half Cheetah Regret (×10³) |
| :---: | :---: | :---: | :---: | :---: |
| ✓ | ✗ | ✗ | 6.5 ± 1.5 | 182.2 ± 14.4 |
| ✓ | ✓ | ✗ | 5.9 ± 0.3 | 141.6 ± 21.5 |
| ✓ | ✗ | ✓ | 7.1 ± 1.0 | 153.0 ± 17.3 |
| ✓ | ✓ | ✓ | **5.7 ± 0.3** | **132.8 ± 10.8** |

All three terms are required to minimize cumulative regret. The conservative update alone reduces regret substantially; combining it with the exploration bonus reaches the lowest regret on both tasks. The ablation on multiple shooting confirms the trend: more actor samples $S$ monotonically reduce cumulative regret and improve sample efficiency.

## Conclusion

- **First PAC-Bayesian actor-critic:** PAC4SAC is the first algorithm to use a PAC-Bayesian generalization bound as a critic training objective, combining Bellman consistency, conservative value updates, and a principled exploration bonus in a single loss.
- **Single critic suffices:** The KL regularization term replaces the standard practice of training two critics to counter overestimation bias, simplifying the architecture without sacrificing (in fact, improving) performance.
- **Multiple shooting pays off:** Critic-guided random action search at interaction time consistently reduces regret and improves sample efficiency, with gains increasing monotonically with the number of samples.
- **Consistent improvement across difficulty:** PAC4SAC outperforms SAC, DDPG, and OAC on all four tasks in both cumulative regret and sample efficiency, with the largest gains on the high-dimensional Ant and Half Cheetah environments.
- **Theory-grounded exploration:** The variance-based exploration bonus arises from the PAC-Bayes derivation itself rather than being added manually, providing a principled alternative to entropy regularization.

---

## References

1. **Tasdighi, B., Akgül, A., Haußmann, M., Brink, K. K., & Kandemir, M. (2024).** PAC-Bayesian Soft Actor-Critic Learning. *Sixth Symposium on Advances in Approximate Bayesian Inference (AABI 2024).*
2. **Haarnoja, T., Zhou, A., Abbeel, P., & Levine, S. (2018).** Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor. *ICML 2018.*
3. **Fujimoto, S., van Hoof, H., & Meger, D. (2018).** Addressing Function Approximation Error in Actor-Critic Methods (TD3). *ICML 2018.*
4. **Lillicrap, T. P., et al. (2015).** Continuous Control with Deep Reinforcement Learning (DDPG). *ICLR 2016.*
5. **Ciosek, K., Vuong, Q., Loftin, R., & Hofmann, K. (2019).** Better Exploration with Optimistic Actor Critic (OAC). *NeurIPS 2019.*
6. **Fard, M. M., Pineau, J., & Szepesvári, C. (2012).** PAC-Bayesian Policy Evaluation for Reinforcement Learning. *arXiv:1206.1839.*
7. **McAllester, D. A. (1999).** PAC-Bayesian Model Averaging. *COLT 1999.*
