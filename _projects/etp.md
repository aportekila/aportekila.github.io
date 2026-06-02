---
layout: project
title: "Evidential Turing Processes"
description: "A unified Bayesian framework combining global and local uncertainty through an external memory mechanism, achieving simultaneous model calibration, class overlap quantification, and out-of-distribution detection on five real-world classification benchmarks. Published at ICLR 2022."
img: assets/img/projects/etp_plate.png
importance: 5
category: Featured Work
venue: "ICLR"
year: 2022
bib_key: "kandemir2022evidential"
---

## Introduction

Reliable machine learning models deployed in safety-critical settings (medical diagnostics, autonomous driving, natural language understanding) must handle three distinct kinds of uncertainty: uncertainty in the model's own fit to the data, uncertainty arising from intrinsic class ambiguity, and uncertainty about whether an input comes from the same domain the model was trained on. Existing Bayesian approaches address these challenges in a piecemeal fashion: **Parametric Bayesian Models (PBMs)** such as Bayesian Neural Networks (BNNs) capture model-level uncertainty well but poorly represent local class ambiguity; **Evidential Bayesian Models (EBMs)** such as Evidential Deep Learning (EDL) quantify class overlap well but lack the global structure needed for out-of-distribution detection. **Evidential Turing Processes (ETP)** introduces a principled unification through the **Complete Bayesian Model (CBM)** framework, which provably inherits the favorable uncertainty decomposition properties of both approaches, realized via a novel **Turing Process**: a stochastic process with an external memory that accumulates in-domain evidence without requiring a context set at test time.

*In this work (2nd author), I designed and conducted all experiments and wrote the experimental section of the paper.*

## Problem Statement

The paper formally defines **Total Calibration** as the simultaneous competence of a discriminative predictor in three distinct tasks:

- **Model misfit**: how closely the model's predicted class distribution matches the true class-conditional distribution, measured by **Negative Log-Likelihood (NLL)**.  Reducible by seeing more training data; signals systematic errors in model fit.

- **Class overlap**: how faithfully the model reflects the irreducible ambiguity at decision boundaries (where two classes genuinely overlap), measured by **Expected Calibration Error (ECE)**.  Cannot be eliminated with more data; requires a local uncertainty mechanism.

- **Domain mismatch**: the ability to detect inputs drawn from a distribution unseen during training (out-of-distribution detection), measured by the **Area Under the ROC Curve (AUROC)**.  Requires a global uncertainty signal that builds up over the training set.

**The key observation:** PBMs maintain a posterior over a global parameter θ; this variance shrinks with data and drives good NLL and AUROC, but poorly captures per-sample class ambiguity. EBMs maintain an observation-specific prior over class probabilities π; this captures class overlap via ECE, but has no global variable to detect domain shift. No prior method achieves all three simultaneously.

## Methodology

### Complete Bayesian Models (CBM)

The CBM framework introduces a **global** parameter θ (from PBM) alongside a **local** class-probability variable π (from EBM). Their joint generative model is:

$$\Pr[y \mid \pi]\; p(\pi \mid \theta, x)\; p(\theta)$$

{% include figure.liquid loading="eager" path="assets/img/projects/etp_three_models.png" title="Three Bayesian modeling approaches" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 1. Plate diagrams of the three Bayesian modeling approaches. Shaded nodes are observed; open circles are latent; the diamond node M is a deterministic external memory. Solid arrows are generative dependencies; dashed arrows are amortized inference paths. (a) Parametric Bayesian Models (PBM): a single global latent θ modulates all predictions; its posterior shrinks with data size, enabling domain-shift detection but not local class-overlap quantification. (b) Evidential Bayesian Models (EBM): a local latent π is inferred per input x via amortized inference; it captures class overlap but has no global variable to detect distribution shift. (c) Complete Bayesian Models (CBM): combines both θ and π, inheriting the favorable uncertainty decomposition properties of each approach.
</div>

The CBM variance decomposition contains all three required uncertainty components:

$$\mathrm{Var}[y \mid x] = \underbrace{\mathrm{Var}_{p(\theta|\mathcal{D})}\!\Big[\mathbb{E}_{p(\pi|x,\theta)}[\mathbb{E}[y|\pi]]\Big]}_{\text{Reducible model uncertainty}} + \underbrace{\mathbb{E}_{p(\theta|\mathcal{D})}\!\Big[\mathrm{Var}_{p(\pi|\theta,x)}[\mathbb{E}[y|\pi]]\Big]}_{\text{Irreducible model uncertainty}} + \underbrace{\mathbb{E}_{p(\theta|\mathcal{D})}\!\Big[\mathbb{E}_{p(\pi|x,\theta)}[\mathrm{Var}[y|\pi]]\Big]}_{\text{Data uncertainty}}$$

The first term recovers the reducible model uncertainty of PBMs (handles model misfit and domain mismatch); the second and third recover the irreducible and data uncertainty of EBMs (handles class overlap). **A CBM is the minimal structure that guarantees total calibration.**

### Turing Processes and the ETP

Equipping the CBM's empirical prior $p(\pi \mid \theta, x)$ with a mechanism that *learns to be accurate* on individual samples requires two ingredients: (1) a global random variable connecting samples across the dataset (as in Neural Processes [[Garnelo et al., 2018]](https://arxiv.org/abs/1807.01622)), and (2) a memory that accumulates evidence from context data without needing to store that context at test time (as in Neural Turing Machines [[Graves et al., 2014]](https://arxiv.org/abs/1410.5401)).

The **Turing Process** is a formally defined stochastic process combining both: its prior $p_M(\theta)$ has free parameters $M$ (the memory), and conditioning on a context set $\mathcal{D}_C$ updates the memory parameters via an explicit rule $r$: $M' = r(M, \mathcal{D}_C)$.  Unlike Neural Processes, no context is required at prediction time, since the memory has absorbed the context during training.

**Evidential Turing Processes (ETP)** instantiate this design as a CBM:

$$p(y,\mathcal{D}_T,\pi, \theta) = p(w)\; \underbrace{p_M(Z)}_{\text{External memory}} \prod_{(x,y)\in\mathcal{D}_T}\Big[p(y|\pi)\;\underbrace{p(\pi \mid Z, w, x)}_{\text{Input-specific prior}}\Big]$$

The global parameters $\theta = \{w, Z\}$ split into a neural network weight $w$ and a memory $Z = \{z_1, \ldots, z_R\}$ parameterized by $M = (m_1, \ldots, m_R)$. Each input $x$ is encoded and matched to memory via **attention**, yielding input-specific Dirichlet hyperparameters for π.  Memory cells are updated by a convex interpolation rule that writes new uncertainty information (both the ground-truth label and the model's current soft prediction) into cells weighted by their similarity to the current input, without gradient-based optimization of $M$.

<div class="row justify-content-center">
<div class="col-sm-8">
{% include figure.liquid loading="eager" path="assets/img/projects/etp_plate.png" title="ETP plate diagram" class="img-fluid rounded z-depth-1" %}
</div>
</div>
<div class="caption">
  Figure 2. ETP generative model (plate diagram). Left plate: context observations (x', y') ∈ D<sub>C</sub> update the memory M via the explicit rule r, which parameterizes the global latent Z (diamond = deterministic node). Right plate: for each target (x, y) ∈ D<sub>T</sub>, the global Z and network weights w jointly determine the input-specific prior over local variable π via an attention mechanism, which then generates the class label y. The dashed arrows mark the amortization and memory-update paths; no context set is needed at test time.
</div>

**Ablation structure:** Deactivating ETP components one at a time recovers established baselines. Removing the external memory and update rule recovers the **Evidential Neural Process (ENP)** (a novel surrogate for the Attentive Neural Process [[Kim et al., 2019]](https://arxiv.org/abs/1901.05761)); further removing the local variable π recovers the standard **Neural Process**; removing the global Z recovers **EDL**; removing both π and Z recovers a **BNN**.

| Model | Local π | Global Z | Memory M | Rule r | Context at test time |
| :--- | :---: | :---: | :---: | :---: | :---: |
| ETP (target) | ✓ | ✓ | ✓ | ✓ | ✗ |
| ENP (surrogate) | ✓ | ✓ | ✗ | ✗ | ✗ |
| EDL | ✓ | ✗ | ✗ | ✗ | ✗ |
| BNN | ✗ | ✗ | ✗ | ✗ | ✗ |

## Results

**Datasets:** Five real-world classification benchmarks covering text and images, each with a designated out-of-distribution dataset for AUROC evaluation:

| Domain data | Architecture | OOD data |
| :--- | :--- | :--- |
| IMDB sentiment | LSTM | Random tokens |
| Fashion MNIST | LeNet-5 | MNIST |
| SVHN | LeNet-5 | CIFAR10 |
| CIFAR10 | LeNet-5 | SVHN |
| CIFAR100 | ResNet-18 | TinyImageNet |

Results are averages over **10 random seeds**. Baselines are BNN, EDL, and ENP (curated as the strongest possible ablation). ETP is the only method that consistently ranks among top performers across all three total-calibration metrics on every dataset.

### Total Calibration Results (mean ± std, 10 seeds)

**Test error ↓ — model fit:**

| | IMDB | Fashion | SVHN | CIFAR10 | CIFAR100 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| BNN | **16.4 ± 0.6** | **7.9 ± 0.1** | 7.9 ± 0.1 | **15.3 ± 0.3** | 30.2 ± 0.3 |
| EDL | 38.3 ± 13.3 | 8.6 ± 0.1 | 7.3 ± 0.1 | 18.5 ± 0.2 | 45.2 ± 0.4 |
| ENP | 50.0 ± 0.0 | **7.9 ± 0.2** | **6.7 ± 0.1** | **14.8 ± 0.2** | 39.0 ± 0.3 |
| **ETP** | **15.8 ± 1.3** | **7.9 ± 0.2** | **6.9 ± 0.1** | **15.3 ± 0.2** | **29.2 ± 0.3** |

**ECE ↓ — class overlap calibration:**

| | IMDB | Fashion | SVHN | CIFAR10 | CIFAR100 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| BNN | 14.4 ± 0.4 | 6.7 ± 0.0 | 6.5 ± 0.0 | 5.5 ± 0.3 | 15.2 ± 0.0 |
| EDL | 41.1 ± 2.6 | 3.7 ± 0.2 | 4.0 ± 0.1 | 9.0 ± 0.2 | **5.3 ± 0.4** |
| ENP | **0.8 ± 1.6** | 6.0 ± 0.2 | 10.7 ± 0.2 | 7.2 ± 0.3 | 39.7 ± 0.4 |
| **ETP** | **3.1 ± 0.4** | **2.6 ± 0.2** | **2.6 ± 0.1** | **2.7 ± 0.1** | 6.6 ± 0.1 |

**NLL ↓ — negative log-likelihood:**

| | IMDB | Fashion | SVHN | CIFAR10 | CIFAR100 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| BNN | 0.47 | 0.65 | 0.71 | 0.50 | 1.78 |
| EDL | 0.66 | 0.37 | 0.34 | 0.72 | 2.24 |
| ENP | 0.69 | 0.34 | 0.33 | 0.50 | 2.52 |
| **ETP** | **0.37** | **0.29** | **0.26** | **0.46** | **1.36** |

**ETP achieves the best NLL on all five datasets**, a result no other method matches.

**AUROC ↑ — out-of-distribution detection:**

| | IMDB | Fashion | SVHN | CIFAR10 | CIFAR100 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| BNN | **60.9 ± 4.2** | 75.9 ± 2.3 | 86.2 ± 0.5 | **84.1 ± 1.3** | 97.2 ± 0.5 |
| EDL | **55.1 ± 5.1** | 77.5 ± 2.0 | 90.9 ± 0.3 | 79.2 ± 0.7 | 89.6 ± 0.3 |
| ENP | **53.7 ± 5.7** | **88.9 ± 1.0** | **92.4 ± 0.4** | **81.4 ± 0.8** | **100.0 ± 0.1** |
| **ETP** | **59.1 ± 5.1** | **90.0 ± 0.9** | 90.0 ± 0.4 | **82.1 ± 0.6** | 99.6 ± 0.1 |

<p class="small text-muted">Bold entries are within three standard deviations of the best result. ETP is the only method that never catastrophically fails on any metric: EDL collapses on IMDB accuracy (38.3% error) and NLL universally; ENP collapses on IMDB (50% error, no better than chance) and NLL; BNN fails at ECE across the board. ETP is the only model that simultaneously achieves top-tier NLL on all five datasets while remaining competitive on ECE and AUROC.</p>

### Robustness Against Gradual Domain Shift

Models are evaluated on corrupted variants of three datasets (FMNIST-C, CIFAR10-C, SVHN-C) using **19 corruption types** (e.g., motion blur, fog, pixelation) at **five severity levels**. The ECE metric is tracked at each corruption level.

{% include figure.liquid loading="eager" path="assets/img/projects/etp_corruption.png" title="ECE under corruption" class="img-fluid rounded z-depth-1" %}
<div class="caption">
  Figure 3. ECE averaged across 19 corruption types at five severity levels on Fashion MNIST (left), CIFAR10 (center), and SVHN (right). ETP maintains the lowest ECE across nearly all datasets and distortion levels, demonstrating that its calibration advantage holds under gradual distributional shift, not only on clean test sets.
</div>

### Computational Cost

Measured on CIFAR10, wall-clock time per epoch: ETP (10.8 ± 0.1 s), BNN (8.2 ± 0.1 s), EDL (8.6 ± 0.1 s), ENP (9.5 ± 0.2 s). ETP incurs a ~14% overhead versus the next-closest baseline (ENP), a modest cost relative to the consistent gain across all three calibration axes.

## Conclusion

- **Total Calibration formalized:** Model misfit, class overlap, and domain mismatch are defined as three formally distinct uncertainty types, each with a designated metric (NLL, ECE, AUROC), providing a rigorous evaluation protocol for uncertainty-aware classifiers.
- **CBM as a unifying theory:** The Complete Bayesian Model framework shows analytically that a model combining a global (PBM-style) and a local (EBM-style) random variable inherits the favorable uncertainty decomposition of each, a strictly necessary structure for total calibration.
- **Turing Process as a practical realization:** The external memory mechanism accumulates uncertainty evidence during training without requiring a context set at test time, making ETP suitable for standard (non-meta-learning) classification pipelines.
- **Unique simultaneous performance:** ETP is the only method among all compared approaches that consistently ranks among top performers on all three calibration metrics across all five real-world datasets.
- **Corruption robustness:** The ECE advantage holds under 19 types of data corruption at five severity levels, confirming that ETP's calibration improvements reflect a genuine improvement in uncertainty structure rather than overfitting to clean-domain statistics.

---

## References

1. **Kandemir, M., Akgül, A., Haussmann, M., & Unal, G. (2022).** Evidential Turing Processes. *International Conference on Learning Representations (ICLR 2022).* [Code](https://github.com/ituvisionlab/EvidentialTuringProcess)
2. **Graves, A., Wayne, G., & Danihelka, I. (2014).** Neural Turing Machines. *arXiv:1410.5401.*
3. **Garnelo, M., Rosenbaum, D., Maddison, C. J., Ramalho, T., Saxton, D., Shanahan, M., Teh, Y. W., Rezende, D. J., & Eslami, S. M. A. (2018).** Neural Processes. *ICML Workshop on Theoretical Foundations and Applications of Deep Generative Models.*
4. **Kim, H., Mnih, A., Schwarz, J., Garnelo, M., Eslami, S. M. A., Rosenbaum, D., Vinyals, O., & Teh, Y. W. (2019).** Attentive Neural Processes. *ICLR 2019.*
5. **Sensoy, M., Kaplan, L., & Kandemir, M. (2018).** Evidential Deep Learning to Quantify Classification Uncertainty. *NeurIPS 2018.*
6. **Malinin, A., & Gales, M. (2018).** Predictive Uncertainty Estimation via Prior Networks. *NeurIPS 2018.*
7. **Hendrycks, D., & Dietterich, T. (2019).** Benchmarking Neural Network Robustness to Common Corruptions and Perturbations. *ICLR 2019.*
