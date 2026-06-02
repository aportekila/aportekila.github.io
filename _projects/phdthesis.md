---
layout: project
title: "Probabilistic Methods for Sample-Efficient Reinforcement Learning"
description: "Doctoral thesis presenting six peer-reviewed algorithms at NeurIPS, ICML, ICLR, TMLR, and UAI, unified by one claim: probabilistic uncertainty representations make reinforcement learning agents faster, more adaptive, and more data-efficient."
img: assets/img/projects/sdu.png
importance: 1
category: Thesis
venue: "Ph.D. Thesis"
year: 2026
bib_key: "akgul2026probabilistic"
---

## Introduction

Reinforcement learning (RL) is a learning paradigm in which an agent maximizes cumulative reward through interaction with an environment, learning via trial and error without labeled supervision. This framework underpins applications in robotics, autonomous systems, recommendation engines, and game playing.

Yet every RL interaction carries a cost: hardware wear, safety risk, time, or data budget. **Sample efficiency** (learning effective policies from as few interactions as possible) is a foundational challenge that cuts across all RL settings. This thesis addresses it through a single research question:

> *How can probabilistic modeling be used to improve sample efficiency in reinforcement learning across diverse learning settings?*

The answer is six published methods, spanning three learning paradigms, that collectively show how representing and acting on uncertainty leads to faster, more robust learning.

## Problem Statement

RL manifests in three settings, each with distinct obstacles to sample efficiency:

- **Online RL**: the agent interacts with a stationary environment. Standard approaches suffer from overestimation bias in value estimates, error propagation through bootstrapping, and lack of principled exploration strategies.

- **Non-stationary RL**: environment dynamics change over time (e.g., a robot whose joints gradually degrade). Agents must detect the shift, preserve plasticity (the ability to keep learning), and re-explore efficiently without the option of a full reset.

- **Offline RL**: no environment interaction is possible; learning proceeds entirely from a fixed, pre-collected dataset. The core danger is distributional shift: value estimates for actions underrepresented in the data become inflated, with no corrective feedback from the environment.

Across all three settings, the shared gap is the same: standard methods do not represent uncertainty explicitly, missing the principal mechanism for learning faster and more reliably.

## Methodology

Six methods are organized under three research objectives.

### Objective 1: Sample-Efficient Value Estimation

Inaccurate value functions slow policy improvement by propagating estimation errors through bootstrapping. Three complementary methods address this:

- [**PAC4SAC**](/projects/pac4sac/): augments Soft Actor-Critic with a PAC-Bayesian critic objective that bounds generalization error directly. Uncertainty estimates from the stochastic critic guide directed exploration via multiple shooting. *(AABI 2024)*

- [**iS-QL**](/projects/isql/): bridges the target-free/target-based dichotomy by sharing all network parameters except the final output layer, and learning K+1 parallel Bellman iterations simultaneously. Achieves target-based stability at near target-free memory cost across online control, offline control, and language modeling. *(ICLR 2026)*

- [**DAIF**](/projects/daif/): formulates quantile regression as Bayesian quantile regression under a Normal-Inverse-Gamma (NIG) generative model. Each (state, action, quantile) triple maps to a full distribution over the return, capturing both aleatoric and epistemic uncertainty. Exploration follows from minimizing Expected Free Energy, with no learned dynamics model required. *(ICML 2026)*

### Objective 2: Sample-Efficient Adaptation to Non-Stationary Environments

When dynamics shift, agents must rapidly detect the change and re-adapt their policies. Two probabilistic methods enable this:

- [**EPPO**](/projects/eppo/): replaces the scalar value head in Proximal Policy Optimization with an evidential (NIG) critic, providing closed-form estimates of both aleatoric and epistemic uncertainty. Epistemic uncertainty identifies distribution shifts, preserving plasticity via hyperprior regularization; uncertainty propagates through the Generalized Advantage Estimator as a UCB bonus for directed exploration. *(TMLR 2025)*

- **WSB**: introduces Weighted Sequential Bayesian inference for non-stationary linear contextual bandits. A Bayesian posterior over drifting reward parameters is maintained through exponentially weighted updates. Novel concentration inequalities explicitly account for prior beliefs and their decay over time, yielding provably efficient algorithms (WSB-LinUCB, WSB-RandLinUCB, WSB-LinTS) that match or improve on frequentist baselines in regret. *(UAI 2026)*

### Objective 3: Sample-Efficient Learning from Fixed Datasets

With no access to new interactions, every data point must be used as effectively as possible:

- [**MOMBO**](/projects/mombo/): identifies high Monte Carlo variance as the primary source of training instability in model-based offline RL. Replaces single-sample Bellman targets with deterministic moment matching: next-state distributions from an ensemble dynamics model are propagated analytically through the Q-network, yielding a closed-form pessimistic Bellman operator. Two theoretical contributions accompany the algorithm: a suboptimality bound for sampling-based approaches showing explicit dependence on the number of samples, and a tighter deterministic bound for the moment-matching counterpart. *(NeurIPS 2024)*

## Results

Evaluated across MuJoCo, PyBullet, DeepMind Control Suite, EvoGym, Atari, and D4RL benchmarks, the six methods consistently improve sample efficiency over their respective baselines:

- [**MOMBO**](/projects/mombo/) achieves state-of-the-art or competitive normalized reward and AULC on D4RL offline benchmarks across halfcheetah, hopper, and walker2d environments, and provides a provably tighter suboptimality guarantee than sampling-based offline RL methods.

- [**EPPO**](/projects/eppo/) ranks first in average AULC among seven baselines on non-stationary MuJoCo locomotion (average rank 1.5), outperforming methods designed for plasticity alone, exploration alone, and standard PPO, showing that both properties are simultaneously necessary.

- [**DAIF**](/projects/daif/) achieves the best average task ranking across 19 continuous control tasks on three benchmark suites, with improvements of up to +62% AULC over the next-best distributional baseline on individual tasks, and competitive performance on pixel-observation tasks without pixel-specialist tuning.

- [**PAC4SAC**](/projects/pac4sac/) achieves the lowest cumulative regret and fewest episodes to task completion across four PyBullet continuous control environments compared to DDPG, SAC, and OAC baselines.

- **WSB** yields provably lower cumulative regret than frequentist non-stationary bandit methods, validated empirically across multiple non-stationary configurations.

- [**iS-QL**](/projects/isql/) matches target-based stability while using near target-free memory, with gains across Atari, DMControl, and offline language modeling tasks.

## Conclusion

This thesis demonstrates that probabilistic modeling is an effective and general mechanism for sample-efficient reinforcement learning. Across settings as different as online control, continual adaptation, and offline policy learning, probabilistic frameworks enable agents to:

- **Learn faster** by grounding exploration in principled uncertainty estimates rather than heuristics.
- **Adapt more reliably** under changing dynamics by detecting distributional shifts in value estimates and preserving plasticity.
- **Extract more from limited data** by replacing high-variance sampling with analytical uncertainty propagation.

Spanning PAC-Bayesian bounds, evidential learning, Bayesian inference, distributional representations, deterministic moment matching, and parameter sharing, the six contributions form a coherent program: treating uncertainty not as a nuisance to be minimized, but as the primary signal for efficient learning.

---

## References

1. **Akgül, A. (2026).** Probabilistic Reinforcement Learning for Sample-Efficient Control. *PhD Thesis, University of Southern Denmark.*
2. **Akgül, A., Haußmann, M., & Kandemir, M. (2024).** Deterministic Uncertainty Propagation for Improved Model-Based Offline Reinforcement Learning. *NeurIPS 2024.*
3. **Akgül, A., Baykal, G., Haußmann, M., & Kandemir, M. (2025).** Overcoming Non-stationary Dynamics with Evidential Proximal Policy Optimization. *TMLR 2025.*
4. **Akgül, A., Baykal, G., Haußmann, M., Çelikok, M. M., & Kandemir, M. (2026).** Distributional Active Inference. *ICML 2026.*
5. **Tasdighi, B., Akgül, A., Haußmann, M., Brink, K. K., & Kandemir, M. (2024).** PAC-Bayesian Soft Actor-Critic Learning. *AABI 2024.*
6. **Werge, N., Wu, Y.S., Akgül, A., & Kandemir, M. (2026).** Weighted Sequential Bayesian Inference for Non-Stationary Linear Contextual Bandits. *Conference on Uncertainty in Artificial Intelligence (UAI) 2026.*
7. **Vincent, T., Tripathi, Y., Faust, T., Akgül, A., Oren, Y., Kandemir, M., Peters, J., & D'Eramo, C. (2026).** Bridging the Performance Gap between Target-free and Target-based Reinforcement Learning. *ICLR 2026.*
