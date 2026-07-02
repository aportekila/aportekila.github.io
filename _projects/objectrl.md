---
layout: project
title: "ObjectRL: An Object-Oriented Reinforcement Learning Codebase"
description: "Extending SAC to a new algorithm takes roughly 5 lines: just override the two methods that change. Full OOP codebase where encapsulation, inheritance, and polymorphism map directly to RL algorithm components. arXiv 2025."
img: assets/img/projects/objectrl_design.png
importance: 8
category: Featured Work
venue: "arXiv"
year: 2025
role: "2nd Author"
bib_key: "baykal2025objectrl"
selected: true
---

## Introduction

Deep reinforcement learning (RL) research depends on codebases that are fast to prototype in, easy to debug, and straightforward to extend. Existing libraries, while powerful, tend to prioritize scalability or off-the-shelf usability over research flexibility: tightly-coupled architectures, deep functional abstractions, and complex configuration systems make it hard to isolate and modify individual algorithmic components. **ObjectRL** is the first deep RL codebase built from the ground up on **Object-Oriented Programming (OOP)** principles, organizing every element of a modern RL algorithm into a clear class hierarchy that mirrors the way researchers think about the problem: agents, actors, critics, replay buffers, and update rules as distinct, composable entities.

## Problem Statement

- **Tightly coupled architectures** in existing codebases (RLlib [[Liang et al., ICML 2018]](https://arxiv.org/abs/1712.09381), Pearl [[Zhu et al., JMLR 2024]](https://arxiv.org/abs/2312.03814), skrl [[Serrano-Muñoz et al., JMLR 2023]](https://arxiv.org/abs/2202.03825)) target production robustness and large-scale deployment, but their complex APIs hinder rapid prototyping and low-level access.
- **Monolithic single-file designs** (CleanRL [[Huang et al., JMLR 2022]](https://arxiv.org/abs/2111.08819)) improve readability but sacrifice modularity; everything lives in one file, making component-level reuse impossible.
- **Unstructured APIs** (Stable-Baselines3 [[Raffin et al., JMLR 2021]]) provide stable implementations but navigation and customization are non-trivial.
- **Deep abstraction layers** (Tianshou [[Weng et al., JMLR 2022]](https://arxiv.org/abs/2107.14171), TorchRL [[Bou et al., 2023]](https://arxiv.org/abs/2306.00577)) can obscure the connection between code and algorithm, making intuitive prototyping difficult.
- **Partial OOP use** (MushroomRL [[D'Eramo et al., JMLR 2021]](https://arxiv.org/abs/2001.01102)) leaves algorithmic exploration less straightforward than a fully OOP-structured alternative.
- **Gap:** No existing codebase fully applies OOP principles (encapsulation, inheritance, composition, and polymorphism) at the level of individual algorithmic components, limiting how easily researchers can swap, extend, or debug a single part without touching the rest.

## Methodology

**ObjectRL is organized around three core OOP principles applied directly to RL algorithm design:**

- **Encapsulation:** Each RL component (agent, critic, actor, replay buffer, logger) is a self-contained class. Attributes describe RL concepts; methods reflect their interactions. Modifications to one class do not propagate unexpectedly.
- **Inheritance and Composition:** A base `Agent` class defines common utilities (replay buffer, logger, training loop). `ActorCritic` inherits from it and defines the actor-critic structure. Algorithm-specific classes (e.g., `SoftActorCritic`, `TD3`) then inherit from `ActorCritic`, specializing only what changes. Actors and critics are composed into agents.
- **Polymorphism:** Shared interfaces (e.g., `update()`, `loss()`, `get_bellman_target()`) allow different actor/critic types to be swapped without modifying the surrounding training loop.

{% include figure.liquid loading="eager" path="assets/img/projects/objectrl_design.png" title="ObjectRL SAC Class Diagram" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. Class diagram of Soft Actor-Critic (SAC) in ObjectRL. Inheritance (arrows) and composition (diamonds) map directly to how RL researchers conceptualize the algorithm: SoftActorCritic is composed of a SACActor and a SACCritic (itself a CriticEnsemble); both inherit from shared base classes. Key attributes and methods are color-coded; algorithm-specific elements (orange) are clearly separated from shared infrastructure (grey).
</div>

**Module structure:** `agents` — base agent classes; `models` — actors, critics, their compositions, and algorithm implementations; `config` — hyperparameters via Python dataclasses; `experiments` — training and evaluation loops; `loggers` — result tracking; `nets` — network architectures; `replay buffers` — experience storage; `utils` — helper functions.

**Implemented algorithms:** DQN [[Mnih et al., Nature 2015]](https://www.nature.com/articles/nature14236), DDPG [[Lillicrap et al., ICLR 2016]](https://arxiv.org/abs/1509.02971), PPO [[Schulman et al., 2017]](https://arxiv.org/abs/1707.06347), TD3 [[Fujimoto et al., ICML 2018]](https://arxiv.org/abs/1802.09477), SAC [[Haarnoja et al., ICML 2018]](https://arxiv.org/abs/1801.01290), OAC [[Ciosek et al., NeurIPS 2019]](https://arxiv.org/abs/1910.12807), REDQ [[Chen et al., ICLR 2021]](https://arxiv.org/abs/2101.05982), DRND [[Yang et al., ICML 2024]](https://arxiv.org/abs/2401.09750), PBAC [[Tasdighi et al., 2024]](https://arxiv.org/abs/2402.03055).

**Prototyping example: SAC → DRND in two steps.** DRND augments SAC with an exploration bonus derived from ensemble disagreement over Q-values. In ObjectRL:
1. Define `DRNDBonus` — a class encapsulating the uncertainty estimation and its hyperparameters.
2. Create `DRNDActor` and `DRNDCritic` — subclasses of `SACActor` and `SACCritic` that override just `loss()` and `get_bellman_target()` to add the bonus term (highlighted below):

```python
# DRNDActor.loss() — adds bonus to the standard entropy-regularized objective
loss, act_dict = super().loss(state, critics)
bonus = bonus_ensemble.bonus(state, action).mean()
return loss + bonus, act_dict

# DRNDCritic.get_bellman_target() — injects bonus into the Bellman backup
bonus = bonus_ensemble.bonus(next_state, next_action)
q_target = target_reduced - alpha * log_prob - self.lambda_critic * bonus
return q_target
```

The existing training loop requires no changes; polymorphism handles the dispatch automatically. Full documentation and additional examples at [objectrl.readthedocs.io](https://objectrl.readthedocs.io).

## Results

All implemented algorithms are evaluated on **five standard MuJoCo continuous control environments** (Ant, HalfCheetah, Hopper, Humanoid, and Walker2D) using the Gymnasium interface [[Towers et al., 2024]](https://arxiv.org/abs/2407.17032), with 5 seeds per algorithm.

{% include figure.liquid loading="eager" path="assets/img/projects/objectrl_results.png" title="MuJoCo Benchmark Results" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 2. Learning curves for all nine implemented algorithms across five MuJoCo environments (mean ± std, 5 seeds). Top row: Ant and HalfCheetah; middle row: Hopper and Humanoid; bottom: Walker2D. Exploration-augmented methods (OAC, DRND, PBAC) lead on challenging tasks like Ant and Humanoid. All implementations reproduce expected relative performance orderings from the published literature, confirming correctness of the codebase.
</div>

The primary purpose of the benchmark is correctness verification: that each algorithm's implementation within ObjectRL's OOP framework reproduces the relative performance ordering and scale reported in the original papers. As one example, on Ant (mean ± std, 5 seeds): TD3 leads at 4,732 ± 655, followed by SAC (3,676 ± 765), OAC (3,526 ± 527), REDQ (3,607 ± 973), and PBAC (3,220 ± 976), while PPO and DDPG score lower as expected for this high-DoF task. All algorithms integrate within the same training infrastructure with no ad-hoc modifications to the loop.

## Conclusion

- **First fully OOP deep RL codebase:** ObjectRL applies encapsulation, inheritance, composition, and polymorphism at the level of individual algorithmic components, not just the training infrastructure.
- **Rapid prototyping with minimal changes:** Extending SAC to DRND requires overriding two methods (~5 lines total); the rest of the training loop, logging, and evaluation machinery is inherited unchanged.
- **Readable, debuggable structure:** The class hierarchy mirrors the conceptual building blocks researchers use, making it straightforward to locate, understand, and modify any part of an algorithm.
- **Nine algorithms, five environments:** Clean, verified implementations of DQN, DDPG, PPO, TD3, SAC, OAC, REDQ, DRND, and PBAC, all benchmarked on standard MuJoCo tasks.
- **Open source:** Code at [github.com/adinlab/objectrl](https://github.com/adinlab/objectrl) · Documentation at [objectrl.readthedocs.io](https://objectrl.readthedocs.io)

---

## References

1. **Baykal, G., Akgül, A., Haußmann, M., Tasdighi, B., Werge, N., Wu, Y.S., & Kandemir, M. (2025).** ObjectRL: An Object-Oriented Reinforcement Learning Codebase. *arXiv:2507.03487.* [objectrl.readthedocs.io](https://objectrl.readthedocs.io)
2. **Mnih, V., et al. (2015).** Human-level control through deep reinforcement learning. *Nature.*
3. **Lillicrap, T.P., et al. (2016).** Continuous control with deep reinforcement learning. *ICLR 2016.*
4. **Haarnoja, T., et al. (2018).** Soft Actor-Critic. *ICML 2018.*
5. **Fujimoto, S., et al. (2018).** Addressing Function Approximation Error in Actor-Critic Methods. *ICML 2018.*
6. **Schulman, J., et al. (2017).** Proximal Policy Optimization Algorithms. *arXiv:1707.06347.*
7. **Chen, X., et al. (2021).** Randomized Ensembled Double Q-Learning. *ICLR 2021.*
8. **Ciosek, K., et al. (2019).** Better Exploration with Optimistic Actor Critic. *NeurIPS 2019.*
9. **Yang, K., et al. (2024).** Exploration and Anti-Exploration with Distributional Random Network Distillation. *ICML 2024.*
10. **Tasdighi, B., et al. (2024).** Deep Exploration with PAC-Bayes. *arXiv:2402.03055.*
11. **Raffin, A., et al. (2021).** Stable-Baselines3: Reliable Reinforcement Learning Implementations. *JMLR.*
12. **Huang, S., et al. (2022).** CleanRL: High-quality Single-file Implementations of Deep Reinforcement Learning Algorithms. *JMLR.*
13. **Todorov, E., et al. (2012).** MuJoCo: A physics engine for model-based control. *IROS 2012.*
