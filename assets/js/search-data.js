// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-abdullah-akgül",
    title: "Abdullah Akgül",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-portfolio",
          title: "Portfolio",
          description: "A curated showcase of my research and industry work, spanning peer-reviewed publications at NeurIPS, ICML, ICLR, and TMLR, doctoral and master&#39;s theses, collaborative contributions, and applied ML projects.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/portfolio/";
          },
        },{id: "nav-curriculum-vitae",
          title: "Curriculum Vitae",
          description: "My Curriculum Vitae",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "nav-publications",
          title: "Publications",
          description: "Peer-reviewed publications in reinforcement learning, probabilistic modeling, and uncertainty quantification.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-repositories",
          title: "Repositories",
          description: "Open-source research codebases and tools.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/repositories/";
          },
        },{id: "news-paper-mombo-deterministic-uncertainty-propagation-for-improved-model-based-offline-reinforcement-learning-accepted-to-neurips-2024",
          title: 'Paper MOMBO “Deterministic Uncertainty Propagation for Improved Model-Based Offline Reinforcement Learning” accepted to...',
          description: "",
          section: "News",},{id: "news-paper-eppo-overcoming-non-stationary-dynamics-with-evidential-proximal-policy-optimization-accepted-to-transactions-on-machine-learning-research-tmlr",
          title: 'Paper EPPO “Overcoming Non-stationary Dynamics with Evidential Proximal Policy Optimization” accepted to Transactions...',
          description: "",
          section: "News",},{id: "news-paper-is-ql-bridging-the-performance-gap-between-target-free-and-target-based-reinforcement-learning-accepted-to-iclr-2026",
          title: 'Paper iS-QL “Bridging the Performance-Gap between Target-free and Target-based Reinforcement Learning” accepted to...',
          description: "",
          section: "News",},{id: "news-started-as-research-assistant-postdoctoral-researcher-at-the-university-of-southern-denmark-continuing-research-on-probabilistic-reinforcement-learning-for-sample-efficient-control",
          title: 'Started as Research Assistant – Postdoctoral Researcher at the University of Southern Denmark,...',
          description: "",
          section: "News",},{id: "news-paper-daif-distributional-active-inference-accepted-to-icml-2026",
          title: 'Paper DAIF “Distributional Active Inference” accepted to ICML 2026.',
          description: "",
          section: "News",},{id: "news-successfully-defended-phd-thesis-probabilistic-reinforcement-learning-for-sample-efficient-control-at-the-university-of-southern-denmark",
          title: 'Successfully defended PhD thesis Probabilistic Reinforcement Learning for Sample-Efficient Control at the University...',
          description: "",
          section: "News",},{id: "news-paper-weighted-sequential-bayesian-inference-for-non-stationary-linear-contextual-bandits-accepted-to-uai-2026-conference-on-uncertainty-in-artificial-intelligence",
          title: 'Paper “Weighted Sequential Bayesian Inference for Non-Stationary Linear Contextual Bandits” accepted to UAI...',
          description: "",
          section: "News",},{id: "projects-bfl-aggregating-variational-bayesian-networks-in-federated-learning",
          title: 'BFL: Aggregating Variational Bayesian Networks in Federated Learning',
          description: "Low-spread aggregation rules match or beat deterministic FedAvg while providing significantly better calibration across clients. First systematic study of aggregation strategies for Variational Bayesian Neural Networks in federated learning. NeurIPS 2022 Workshop.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/bfl.html";
            },},{id: "projects-cddp-continual-learning-of-multi-modal-dynamics",
          title: 'CDDP: Continual Learning of Multi-modal Dynamics',
          description: "Learns new dynamical modes sequentially without catastrophic forgetting or mode labels, outperforming parameter-transfer baselines on 4 out of 5 datasets. Neural episodic memory with a Dirichlet Process prior for automatic mode discovery. L4DC 2024.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/cddp.html";
            },},{id: "projects-distributional-active-inference",
          title: 'Distributional Active Inference',
          description: "Best average rank across 19 continuous control tasks on three benchmark suites, with up to +62% sample efficiency over the next-best baseline. Integrates Active Inference into distributional RL without a world model. ICML 2026.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/daif.html";
            },},{id: "projects-eppo-evidential-proximal-policy-optimization",
          title: 'EPPO: Evidential Proximal Policy Optimization',
          description: "State-of-the-art in non-stationary control: average rank 1.5 across 10+ environments. Evidential critic simultaneously preserves plasticity and drives directed exploration from a single probabilistic framework. TMLR 2025.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/eppo.html";
            },},{id: "projects-evidential-turing-processes",
          title: 'Evidential Turing Processes',
          description: "The only model achieving top-tier performance on calibration, class overlap, and OOD detection simultaneously across five real-world benchmarks. External memory unifies global and local uncertainty in a single principled framework. ICLR 2022.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/etp.html";
            },},{id: "projects-is-ql-bridging-target-free-and-target-based-reinforcement-learning",
          title: 'iS-QL: Bridging Target-free and Target-based Reinforcement Learning',
          description: "Closes the 10–60% performance gap between target-free and target-based RL by sharing all parameters except the final linear head — matching target-based stability at near target-free memory cost across Atari, DMC, and language modeling. ICLR 2026.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/isql.html";
            },},{id: "projects-memory-based-approaches-to-problems-in-probabilistic-modeling",
          title: 'Memory-based Approaches to Problems in Probabilistic Modeling',
          description: "Master&#39;s thesis at Istanbul Technical University demonstrating that external memory solves two open problems in probabilistic ML: total calibration of neural networks (ETP, ICLR 2022) and continual learning of multi-modal dynamical systems (CDDP, L4DC 2024).",
          section: "Projects",handler: () => {
              window.location.href = "/projects/mastersthesis.html";
            },},{id: "projects-mombo-deterministic-uncertainty-propagation-for-offline-rl",
          title: 'MOMBO: Deterministic Uncertainty Propagation for Offline RL',
          description: "Best convergence rate (avg AULC rank 1.2) across all 12 D4RL offline benchmarks. Deterministic moment matching replaces Monte Carlo Bellman targets, with provably tighter suboptimality bounds. NeurIPS 2024.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/mombo.html";
            },},{id: "projects-objectrl-an-object-oriented-reinforcement-learning-codebase",
          title: 'ObjectRL: An Object-Oriented Reinforcement Learning Codebase',
          description: "Extending SAC to a new algorithm takes roughly 5 lines: just override the two methods that change. Full OOP codebase where encapsulation, inheritance, and polymorphism map directly to RL algorithm components. arXiv 2025.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/objectrl.html";
            },},{id: "projects-pac4sac-pac-bayesian-soft-actor-critic-learning",
          title: 'PAC4SAC: PAC-Bayesian Soft Actor-Critic Learning',
          description: "2-3x sample efficiency improvement on high-dimensional tasks (Ant), best cumulative regret across all four PyBullet environments. First actor-critic using a PAC-Bayesian generalization bound as the critic training objective. AABI 2024.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/pac4sac.html";
            },},{id: "projects-probabilistic-methods-for-sample-efficient-reinforcement-learning",
          title: 'Probabilistic Methods for Sample-Efficient Reinforcement Learning',
          description: "Doctoral thesis presenting six peer-reviewed algorithms at NeurIPS, ICML, ICLR, TMLR, and UAI, unified by one claim: probabilistic uncertainty representations make reinforcement learning agents faster, more adaptive, and more data-efficient.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/phdthesis.html";
            },},{id: "projects-signature-verification-for-fraud-detection",
          title: 'Signature Verification for Fraud Detection',
          description: "Siamese CNN trained on handwritten signatures deployed at Vakifbank R&amp;D for cheque fraud detection — 95% accuracy on internal data, 88% on the public CEDAR benchmark.",
          section: "Projects",handler: () => {
              window.location.href = "/projects/vakifbank.html";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%61%62%64%75%6C%6C%61%68%61%6B%67%75%6C%37%30@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/aportekila", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/abdullahakgul70", "_blank");
        },
      },{
        id: 'social-orcid',
        title: 'ORCID',
        section: 'Socials',
        handler: () => {
          window.open("https://orcid.org/0000-0002-0489-9493", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=FZeaKPoAAAAJ", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
