---
layout: about
title: Abdullah Akgül
permalink: /
nav_order: 1
subtitle: "Postdoctoral Researcher · <a href='https://www.sdu.dk/en/om_sdu/institutter_centre/imada'>University of Southern Denmark</a>"

profile:
  align: right
  image: AbdullahAkgul.jpeg
  image_circular: true # crops the image to make it circular
  more_info: >
    <p><a href='https://adinlab.github.io/'>ADIN Lab</a> · Odense, Denmark</p>

announcements:
  enabled: true
  scrollable: true
  limit: 5
selected_papers: true # includes a list of papers marked as "selected={true}"
social: true # includes social icons at the bottom of the page

---

I am a Postdoctoral Researcher at the [University of Southern Denmark](https://www.sdu.dk/en/om_sdu/institutter_centre/imada), working in the [ADIN Lab](https://adinlab.github.io/) on **sample-efficient reinforcement learning**. My research builds probabilistic algorithms that make agents learn faster by treating uncertainty as a signal rather than noise. Three of my algorithms rank first in sample efficiency on their respective benchmarks, with publications at **NeurIPS**, **ICML**, **ICLR**, and **TMLR**.

My work covers three reinforcement learning settings. For offline RL, **MOMBO** (NeurIPS 2024) replaces high-variance Monte Carlo Bellman targets with deterministic moment matching, achieving the best convergence rate on D4RL locomotion benchmarks alongside a provably tighter suboptimality bound than existing methods. For non-stationary environments, **EPPO** (TMLR 2025) equips standard policy optimization with an evidential critic that simultaneously preserves the network capacity to keep learning and directs exploration toward regions where dynamics have shifted. For online RL, **DAIF** (ICML 2026) integrates Active Inference into distributional RL by formulating quantile regression as Bayesian inference under a Normal-Inverse-Gamma model, enabling Expected Free Energy-driven exploration without a learned dynamics model. Across all three settings, the finding is consistent: explicit probabilistic representations make agents measurably faster and more robust.