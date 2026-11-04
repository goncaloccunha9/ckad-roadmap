# CKAD Roadmap

**A complete, checkbox-driven plan to pass the Certified Kubernetes Application Developer exam in 8 weeks.**

Every box is a concrete action: what to study, which drill to solve, when to take a mock, how to set up for exam day. Work through the boxes, pass the readiness gates, and the exam won't surprise you.

### ▶ [Open the interactive roadmap](https://goncaloccunha9.github.io/ckad-roadmap/)

It tracks your progress, lays out the weeks from your exam date, and tells you when you're ready to sit the exam. No sign-up: progress is saved in your browser only.

---

## Why this works

- **It follows the official curriculum.** Every week maps to the [CKAD curriculum v1.37](https://github.com/cncf/curriculum) domains and their weights, with nothing missing and nothing extra.
- **It's built on drills.** The CKAD is a hands-on exam against the clock, so most of the plan is timed practice: 45 drills and 6 exam-style scenarios with solutions.
- **It goes heavy on high-yield topics.** Rollouts, Ingress + Services, NetworkPolicies, ConfigMaps/Secrets, SecurityContext and container images get the most repetition.
- **You don't decide when you're ready by feel.** Objective readiness gates tell you when to sit the exam and when to reschedule.
- **It covers the exam environment.** Shortcuts, the remote desktop, keyboard pitfalls and time strategy each lose people points. They're all covered in [EXAM-DAY.md](EXAM-DAY.md).

## Start here

1. **⭐ Star / fork this repo** so you can find it again.
2. **Open the [interactive roadmap](https://goncaloccunha9.github.io/ckad-roadmap/)** and set your exam date. Prefer Markdown? Use [ROADMAP.md](ROADMAP.md).
3. **Do Week 0 today:** buy the exam, pick a course from [RESOURCES.md](RESOURCES.md), get a practice cluster.
4. Then one week at a time. Learn → drill → checkpoint.

## The plan at a glance

| Week | Focus | Domain weight |
|---|---|---|
| 0 | Setup: exam booked, course chosen, cluster ready, vim configured | — |
| 1 | Core concepts, imperative kubectl, **container images** | Design & Build · 20% |
| 2 | Workloads, Jobs/CronJobs, multi-container Pods, storage | Design & Build · 20% |
| 3 | ConfigMaps, Secrets, resources & quotas, SecurityContext, ServiceAccounts, RBAC, CRDs | Env, Config & Security · **25%** |
| 4 | **Rolling updates & rollbacks**, blue/green, canary, Helm, Kustomize | Deployment · 20% |
| 5 | **Services, Ingress, NetworkPolicies**, probes, debugging, API deprecations | Networking 20% · Observability 15% |
| 6 | Speed: mixed scenarios, course mocks, docs navigation, redo list | all |
| 7 | **killer.sh #1** → review → remediation | all |
| 8 | **killer.sh #2** → readiness gates → exam environment check → **exam** | all |

Short on time or already use Kubernetes daily? Compress Weeks 1–5 into 2–3 weeks. Don't skip Weeks 6–8.

## What's inside

| | |
|---|---|
| [**Interactive roadmap**](https://goncaloccunha9.github.io/ckad-roadmap/) · [ROADMAP.md](ROADMAP.md) | The week-by-week plan with checkboxes and readiness gates |
| [**drills/**](drills/) | 45 timed drills by domain + 6 multi-step exam-style scenarios, all with solutions |
| [**notes/**](notes/) | Study notes for every topic, with full YAML examples and exam tips |
| [**CHEATSHEET.md**](CHEATSHEET.md) | The imperative commands and flags that save the most time |
| [**EXAM-DAY.md**](EXAM-DAY.md) | Environment, shortcuts, setup, time strategy, checklist |
| [**RESOURCES.md**](RESOURCES.md) | Which course to choose, where to practise, which docs you'll have in the exam |
| [**Kubernetes big picture**](https://goncaloccunha9.github.io/ckad-roadmap/big-picture.html) | A one-page visual map of how the objects fit together |

## The exam at a glance

| | |
|---|---|
| Format | 15–20 hands-on tasks in a live terminal, remotely proctored |
| Duration | 2 hours |
| Passing score | 66% |
| Kubernetes version | v1.37 |
| Price | $445, with one free retake and two killer.sh simulator sessions |
| Validity | 2 years |
| Allowed docs | kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs |

Source: [Linux Foundation CKAD page](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/) and [exam tips](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad), checked November 2026. The Linux Foundation updates the exam regularly, so check those pages before you book.

## Contributing

Found a mistake, an outdated command, or a drill that could be better? Open an issue or a pull request. The roadmap content lives in [`docs/roadmap.js`](docs/roadmap.js). After editing it, run `node scripts/build-roadmap.js` to regenerate `ROADMAP.md`.

Please **don't** submit real exam questions. They're covered by the exam's confidentiality agreement.

## Disclaimer

This is an independent study guide. It isn't affiliated with or endorsed by the Linux Foundation or the CNCF. CKAD is a trademark of the Linux Foundation. All drills and notes are original. They contain no exam content.

## License

[CC BY 4.0](LICENSE). Use it, share it, adapt it. Just give credit.
