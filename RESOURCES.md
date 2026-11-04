# Resources

You don't need many resources. You need **one** course, a practice cluster, the two killer.sh sessions, and a lot of repetition. Everything here is either free or included with the exam, except the course.

## 1. Pick one course

| Course | Why | Cost |
|---|---|---|
| **[Kubernetes Certified Application Developer (CKAD) with Tests](https://www.udemy.com/course/certified-kubernetes-application-developer/)**, Mumshad Mannambeth / KodeKloud (Udemy) | **Recommended.** Short videos, each followed by a browser lab. Lightning labs and mock exams at the end. Structured around the CKAD curriculum domains. | Udemy price. It goes on sale often, so don't pay full price. |
| [LFD259 — Kubernetes for Developers](https://training.linuxfoundation.org/training/kubernetes-for-developers/) (Linux Foundation) | The official course, sold as a bundle with the exam. Thorough and text-heavy. | Bundle with the exam |
| [KodeKloud CKAD course](https://kodekloud.com/) | The same author as the Udemy course, on the KodeKloud platform with extra labs. Worth it if you already have a KodeKloud subscription. | Subscription |

Pick one and finish it. Switching courses halfway through costs time you'd rather spend drilling.

## 2. Practise

| Resource | Use it for | Cost |
|---|---|---|
| **[killer.sh CKAD simulator](https://killer.sh/ckad)** | Two sessions come with the exam, each with a different set of 17 questions, available for 36 hours after you activate it, with automatic scoring and full solutions. Use them in Weeks 7 and 8, not earlier. | Included |
| [Killercoda CKAD](https://killercoda.com/ckad) | Browser scenarios per topic, plus [free playgrounds](https://killercoda.com/playgrounds) for the drills in this repo. | Free tier |
| [This repo's drills](drills/) | 45 timed drills + 6 exam-style scenarios with solutions. | Free |
| [dgkanatsios/CKAD-exercises](https://github.com/dgkanatsios/CKAD-exercises) | The classic community exercise set. Organised by an older curriculum, but still excellent for repetition. | Free |
| [kind](https://kind.sigs.k8s.io/) | A local cluster in Docker/Podman for offline practice. | Free |

## 3. Docs you'll have in the exam

During the exam you may open only the [allowed resources](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed):

- https://kubernetes.io/docs, including its search
- https://kubernetes.io/blog
- https://helm.sh/docs

`kubectl.docs.kubernetes.io` (the Kustomize reference), GitHub, Stack Overflow and any search engine are **not** allowed. Practise with the allowed docs only, so you already know where everything is on exam day. The pages you'll open most:

- [kubectl quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) · [NetworkPolicies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · [SecurityContext](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [PersistentVolumes](https://kubernetes.io/docs/tutorials/configuration/configure-persistent-volume-storage/) · [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [Kustomize task page](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/) · [Using Helm](https://helm.sh/docs/intro/using_helm/)
- [API deprecation guide](https://kubernetes.io/docs/reference/using-api/deprecation-guide/)

## 4. Official pages (read once, at the start)

- [CKAD exam page](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/): price, format, current Kubernetes version
- [Curriculum (CNCF)](https://github.com/cncf/curriculum): the official scope, one PDF
- [Candidate Handbook](https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2): rules, ID, rescheduling, retakes
- [Important tips for CKA & CKAD](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad): the exam environment, shortcuts and pre-installed tools

## What to avoid

- **"Exam dumps" and leaked questions.** They break the exam's confidentiality agreement, can get a certification revoked, and nothing guarantees they're accurate. Everything in this repo is original.
- **Collecting courses.** A second course feels productive, but drilling is what moves your score.
- **Using killer.sh too early.** It's most useful once you've covered everything. Using it in Week 2 wastes one of your two sessions.
