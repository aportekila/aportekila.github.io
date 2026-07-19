---
layout: project
title: "Memory-based Approaches to Problems in Probabilistic Modeling"
description: "Master's thesis at Istanbul Technical University demonstrating that external memory solves two open problems in probabilistic ML: total calibration of neural networks (ETP, ICLR 2022) and continual learning of multi-modal dynamical systems (CDDP, L4DC 2024)."
img: assets/img/projects/itu.png
importance: 2
category: Thesis
venue: "Master's Thesis"
year: 2022
role: "First Author"
bib_key: "akgul2022memory"
---

## Introduction

**External memory** (an explicit, addressable store of information that a neural network can read from and write to) has proven effective in many machine learning settings, from question answering to meta-learning. This thesis asks whether external memory can serve as a general-purpose mechanism for solving open problems in **probabilistic modeling**: the branch of machine learning concerned with representing and reasoning under uncertainty.

The answer is yes. Two distinct, previously unsolved problems in probabilistic modeling are addressed: one in uncertainty quantification, one in continual learning. External memory turns out to be the key ingredient in both.

## Problem Statement

**Problem 1: Total Calibration of Neural Networks**

Deploying a probabilistic neural network in a safety-critical domain (medical diagnostics, autonomous driving) requires it to satisfy three properties at the same time:

- **Model fit** — the model accurately captures the in-domain data distribution
- **Class overlap calibration** — predicted probabilities faithfully reflect genuine ambiguity at class boundaries
- **Out-of-distribution (OOD) detection** — the model reliably flags inputs that fall outside the training domain

Prior work treated these as separate problems: Bayesian Neural Networks (BNNs) handle OOD detection well but not class calibration; Evidential Deep Learning (EDL) handles class calibration but has no global signal for OOD detection. No single model, and no unified formal framework, existed for achieving all three simultaneously. This is the problem of **total calibration**.

**Problem 2: Continual Learning of Multi-modal Dynamical Systems**

Probabilistic State-Space Models (SSMs) are the gold standard for dynamics modeling, with applications in weather forecasting, robotics, and stochastic optimal control. A key open challenge is **continual learning (CL)**: a model must learn new behavioral modes of a dynamical system one task at a time, without forgetting the modes it has already learned. The standard CL fix of transferring model parameters from one task to the next (as in Variational Continual Learning) fails for multi-modal dynamics because different modes can have fundamentally different transition structures that cannot coexist in the same parameter space. Prior work on CL had not studied this setting at all.

## Methodology

Both contributions adopt external memory as their core mechanism, in different probabilistic modeling contexts.

### [ETP](/projects/etp.html) — Evidential Turing Processes (for Total Calibration)

The key insight is that total calibration requires *two* kinds of uncertainty to coexist: a **global** uncertainty that shrinks with more data (handling OOD detection) and a **local**, per-input uncertainty that captures class overlap. This motivates:

- **Complete Bayesian Models (CBM):** A new theoretical framework that combines a global parameter θ (from BNNs) and a local class-probability variable π (from EDL). A variance decomposition shows that a CBM is the *minimal* structure necessary to represent all three calibration components simultaneously.

- **Turing Process:** ETP instantiates CBM using a neural episodic memory: a set of learnable memory slots updated during training via an explicit write rule. At inference, input queries retrieve relevant uncertainty information from memory via attention, without needing a held-out context set. This memory acts as the mechanism that makes the global uncertainty signal accurate and data-driven.

### [CDDP](/projects/cddp.html) — Continual Dynamic Dirichlet Process (for Continual Learning of Dynamics)

Instead of transferring model parameters between tasks (which overwrites old knowledge), CDDP stores a compact **mode descriptor** per dynamical mode in an external memory and retrieves it on demand:

- **Bayesian State-Space Model (BSSM)** provides the probabilistic dynamics backbone.
- **Neural episodic memory with a Dirichlet Process prior** on attention weights stores one descriptor per discovered mode. The DP prior encourages efficient slot usage and supports automatic mode discovery without explicit mode labels.
- **Cross-task transfer via retrieval:** When a new mode is encountered, similar past-mode descriptors are retrieved from memory and fed into the transition kernel as an additional input, reusing past knowledge without modifying earlier representations.

A competitive VCL-based baseline is curated from scratch, as no prior baseline existed for this new problem.

## Results

**ETP — Total Calibration:**

Evaluated across five real-world benchmarks (IMDB text, Fashion MNIST, SVHN, CIFAR10, CIFAR100) with 10 random seeds. Four metrics are reported: test error (model fit), ECE (class overlap), NLL (unified model fit), and AUROC (OOD detection).

- ETP achieves the **best NLL on all five datasets**, a result no other method matches.
- ETP is the **only model** that consistently ranks among top performers on all three calibration axes; every baseline collapses on at least one metric (EDL on IMDB accuracy, ENP on IMDB accuracy, BNN on ECE across all datasets).
- The advantage holds under **19 corruption types at 5 severity levels**, confirming that external memory improves the *structure* of uncertainty, not just performance on clean data.

**CDDP — Continual Multi-modal Dynamics:**

Evaluated on synthetic and adapted real-world time-series datasets under sequential task arrivals. Measured by Normalized Mean Squared Error and NLL.

- CDDP **compares favorably** to the VCL parameter-transfer baseline across all settings, showing that memory-based knowledge transfer is a more effective strategy than parameter reuse for multi-modal dynamics.

## Conclusion

The central finding of this thesis is that **external memory is highly beneficial for problems of probabilistic modeling**:

- For **uncertainty quantification**, memory provides the global signal needed to simultaneously fit in-domain data, calibrate class probabilities, and detect out-of-distribution inputs. No prior method could achieve this without memory.
- For **continual learning of dynamics**, memory enables cross-task knowledge transfer without parameter overwriting, solving catastrophic forgetting in a setting (multi-modal dynamical systems) where the standard parameter-transfer remedy fails.

Together, [ETP](/projects/etp.html) and [CDDP](/projects/cddp.html) establish external memory as a principled, broadly applicable tool in the probabilistic modeling toolkit, effective wherever a model must accumulate and selectively reuse structured knowledge about its domain.

---

## References

1. **Akgül, A. (2022).** Memory-based Approaches to Problems in Probabilistic Modeling. *Master's Thesis, Istanbul Technical University.*
2. **Kandemir, M., Akgül, A., Haußmann, M., & Ünal, G. (2022).** Evidential Turing Processes. *International Conference on Learning Representations (ICLR 2022).*
3. **Akgül, A., Ünal, G., & Kandemir, M. (2024).** Continual Learning of Multi-modal Dynamics with External Memory. *Learning for Dynamics and Control Conference (L4DC 2024).*
