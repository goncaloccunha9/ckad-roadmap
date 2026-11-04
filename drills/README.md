# Drills

Exam-style exercises with solutions, grouped by curriculum domain. All are original and written for this repo.

| File | Domain | Weight |
|---|---|---|
| [01-design-and-build.md](01-design-and-build.md) | Application Design and Build | 20% |
| [02-config-and-security.md](02-config-and-security.md) | Application Environment, Configuration and Security | 25% |
| [03-deployment.md](03-deployment.md) | Application Deployment | 20% |
| [04-services-and-networking.md](04-services-and-networking.md) | Services and Networking | 20% |
| [05-observability.md](05-observability.md) | Application Observability and Maintenance | 15% |
| [06-mixed-scenarios.md](06-mixed-scenarios.md) | Mixed, exam-style, multi-step | — |

## How to use them

1. Read the task, start a timer, and solve it **without opening the solution**. Use only the docs you're allowed to use in the exam.
2. Verify your work. Each solution ends with a check.
3. Beat the target time → tick it in the roadmap. Over the target, or you had to peek → it goes on your redo list.
4. Delete the namespace when you're done (`kubectl delete ns <name>`) and redo the drill from scratch two days later.

Labels: **High yield** = a core skill that's heavily weighted in the curriculum or reused across many tasks. It's this guide's judgement, not official exam data, and everything else is still in scope. Target times are goals for when you've drilled the topic, not official numbers. Your first attempt will be slower.

## Practice cluster

Pick one:

- **Killercoda** (browser, nothing to install): open a [Kubernetes playground](https://killercoda.com/playgrounds). You get a real Linux terminal with a cluster, just like in the exam.
- **kind** (local, needs Docker or Podman):

  ```bash
  kind create cluster --name ckad
  kubectl cluster-info --context kind-ckad
  ```

  Ingress drills need an Ingress controller and NetworkPolicy drills need a CNI that enforces policies. Killercoda playgrounds are the simplest way to get both. Locally, follow the [kind ingress guide](https://kind.sigs.k8s.io/docs/user/ingress/).

Image drills need `docker` or `podman` on the machine. In the exam, image tasks give you one of them on the host you're told to `ssh` into. Learn both. The commands you need are identical.

## Conventions used in every drill

```bash
alias k=kubectl                      # already set up in the exam
export do="--dry-run=client -o yaml" # e.g. k run web --image=nginx $do > web.yaml
```

Every drill works in its own namespace, so you can clean up in one command.
