---
layout: project
title: "Signature Verification for Fraud Detection"
description: "Siamese CNN trained on handwritten signatures deployed at Vakifbank R&D for cheque fraud detection — 95% accuracy on internal data, 88% on the public CEDAR benchmark."
img: assets/img/projects/vakifbank.png
importance: 10
category: Industry Experience
institution: "Vakifbank"
year: 2020
role: "ML Engineer"
---

## Overview

Handwritten signature verification is a key fraud prevention mechanism in banking: detecting whether a signature on a cheque or document matches the account holder's reference signature. Classical rule-based systems are brittle under natural signing variability; the challenge is distinguishing genuine intra-personal variation from skilled forgeries.

This project, completed as a part-time ML engineer in Vakifbank's R&D and Innovation department, delivered a deep learning–based signature verification system from data pipeline through deployment evaluation.

## Approach

**Model:** A **Siamese Convolutional Neural Network** — two weight-sharing CNN branches that each encode a signature image into a fixed-length embedding, with a contrastive loss that pulls genuine-pair embeddings together and pushes forged-pair embeddings apart.

**Why Siamese networks:** Traditional classifiers require retraining when a new account holder is enrolled. A Siamese network learns a similarity metric that generalizes to previously unseen signers at test time, making it practical for a banking system where the customer base grows continuously.

**Pipeline:**
- Preprocessing: binarization, noise removal, and size normalization of raw signature scans
- Training: contrastive loss with margin, Adam optimizer
- Inference: threshold on embedding distance to classify genuine vs. forged

## Results

| Dataset | Accuracy |
| :--- | :---: |
| Vakifbank internal test set | **95%** |
| CEDAR public benchmark | **88%** |

The CEDAR benchmark (Cherry, Eaddy, and Dupont Advanced Research) is a standard public dataset for offline handwritten signature verification, providing an independent measure of generalization beyond the bank's own data distribution.

## Skills Applied

Python · TensorFlow 2 · Keras · Convolutional Neural Networks · Siamese Networks · Contrastive Learning · Image Preprocessing · OpenCV
