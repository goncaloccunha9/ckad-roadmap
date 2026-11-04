<!-- Generated from docs/roadmap.js by scripts/build-roadmap.js. Edit the source, not this file. -->
# CKAD Roadmap

> **Prefer clicking boxes?** The [interactive version](https://goncaloccunha9.github.io/ckad-roadmap/) tracks your progress, schedules the weeks from your exam date and gates your go/no-go. To tick boxes here instead, fork the repo and edit this file, or paste it into a GitHub issue.

Exam: Kubernetes v1.37 · 2 hours · 15–20 performance-based tasks · pass mark 66% · $445 (one free retake + two killer.sh sessions included).

| Domain | Weight |
|---|---|
| Application Environment, Configuration and Security | 25% |
| Application Design and Build | 20% |
| Application Deployment | 20% |
| Services and Networking | 20% |
| Application Observability and Maintenance | 15% |

## Daily rules

1. Practise in a terminal with vim every day. No IDE, no YAML linters, no copy-paste from your notes.
2. Spend 20 minutes a day on imperative speed: `kubectl create/run/expose ... --dry-run=client -o yaml`.
3. During practice, only open docs you're allowed to use in the exam (kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs).
4. Time every drill. In the exam, knowing how to do something isn't enough. You have to do it fast.
5. Any drill you fail goes on a redo list. Repeat it two days later, then again a week later.

## Week 0 — Set up

**Goal:** Commit to an exam date and have a working practice environment before you study anything.

- [ ] **setup** Download the current CKAD curriculum (v1.37) and keep it next to you. It's the official scope. — [Curriculum](https://github.com/cncf/curriculum)
- [ ] **setup** Read the Candidate Handbook and the CKA/CKAD exam tips page end to end (rules, ID, environment, shortcuts). — [Handbook](https://docs.linuxfoundation.org/tc-docs/certification/lf-handbook2) · [Exam tips](https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad)
- [ ] **setup** Buy the exam. The Linux Foundation runs frequent discounts, so check for one before paying full price. — [CKAD](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/)
- [ ] **setup** Schedule the exam about 8 weeks from today. A fixed date keeps you moving, and you can still reschedule.
- [ ] **setup** Pick ONE primary course and stick to it. See the recommendations in RESOURCES. — [Resources](RESOURCES.md)
- [ ] **setup** Get a practice cluster: a Killercoda playground in the browser, or kind locally. — [Killercoda](https://killercoda.com/playgrounds) · [kind](https://kind.sigs.k8s.io/) · [Lab setup](drills/README.md)
- [ ] **setup** Set up vim for YAML (`set ts=2 sw=2 et ai nu`). Learn: dd, yy, p, u, V + > / <, :set paste, /search. — [Cheat sheet](CHEATSHEET.md)

## Week 1 — Core concepts & container images

_Domain: Application Design and Build_

**Goal:** Create and inspect Pods, Deployments and Namespaces imperatively, and build, tag and export container images.

- [ ] **learn** Course: core concepts. Pods, ReplicaSets, Deployments, Namespaces, labels and selectors. — [Notes](notes/02-core-concepts.md)
- [ ] **learn** Imperative commands: `kubectl run`, `create deploy`, `expose`, `--dry-run=client -o yaml`, `kubectl explain --recursive`. — [kubectl quick reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/)
- [ ] **learn** Container images: Dockerfile basics (FROM, COPY, RUN, CMD vs ENTRYPOINT, ENV, USER). Build, tag, push and save with both docker and podman. **[high yield]** — [podman](https://docs.podman.io/en/latest/Commands.html) · [docker](https://docs.docker.com/reference/cli/docker/)
- [ ] **drill** Drills: Application Design and Build, 1.1 – 1.6. — [Drills](drills/01-design-and-build.md)
- [ ] **practice** Speed run: create 10 different Pods/Deployments from scratch (env vars, labels, ports, commands). Aim for under 60s each.
- [ ] **checkpoint** Checkpoint: without docs, write a Pod with 2 labels, an env var, a command and resource requests in under 2 minutes.

## Week 2 — Workloads, multi-container Pods & storage

_Domain: Application Design and Build_

**Goal:** Pick the right workload for a task, combine containers in a Pod, and persist data.

- [ ] **learn** Workloads: Deployment vs DaemonSet vs StatefulSet vs Job vs CronJob. Know when to use each. — [Notes](notes/06-pod-design.md)
- [ ] **learn** Jobs and CronJobs: completions, parallelism, backoffLimit, activeDeadlineSeconds, ttlSecondsAfterFinished, concurrencyPolicy, history limits. **[high yield]** — [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) · [CronJobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [ ] **learn** Multi-container patterns: init containers, native sidecars (`restartPolicy: Always` on an init container), a shared emptyDir. **[high yield]** — [Notes](notes/04-multi-container-pods.md) · [Sidecars](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/)
- [ ] **learn** Volumes: emptyDir, hostPath, PV, PVC, StorageClass, access modes, reclaim policy, binding rules. — [Notes](notes/08-state-persistence.md) · [PV docs](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [ ] **drill** Drills: Application Design and Build, 1.7 – 1.12. — [Drills](drills/01-design-and-build.md)
- [ ] **practice** Killercoda: work through the CKAD scenarios on workloads, multi-container Pods and storage. — [Killercoda CKAD](https://killercoda.com/ckad)
- [ ] **checkpoint** Checkpoint: in under 5 minutes, write a Pod with an init container, a sidecar sharing an emptyDir, and a PVC mount.

## Week 3 — Configuration & security

_Domain: Application Environment, Configuration and Security (25%)_

**Goal:** Cover the heaviest domain: config injection, resource governance, Pod security and identity.

- [ ] **learn** ConfigMaps and Secrets: create them imperatively, then consume via env, envFrom and volume (including a single key via subPath). **[high yield]** — [Notes](notes/03-configuration.md)
- [ ] **learn** Requests and limits, LimitRange, ResourceQuota. Understand why a Pod is rejected or stays Pending. **[high yield]** — [Resources](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) · [Quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [ ] **learn** SecurityContext: runAsUser/Group, runAsNonRoot, fsGroup, readOnlyRootFilesystem, allowPrivilegeEscalation, capabilities add/drop. Know which fields go at Pod level and which at container level. **[high yield]** — [Notes](notes/09-security.md) · [Docs](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [ ] **learn** ServiceAccounts, Roles and RoleBindings: create a SA, assign it to a Deployment, `kubectl create token`, `kubectl auth can-i --as=system:serviceaccount:<ns>:<sa>`. — [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [ ] **learn** CRDs and Operators: discover them (`kubectl get crd`, `kubectl explain <kind>`) and create a custom resource from an existing CRD. — [Custom resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [ ] **learn** Authentication, authorization and admission control at concept level. Know the request flow and what an admission controller can reject. _[concept only]_ — [Admission](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/)
- [ ] **drill** Drills: Application Environment, Configuration and Security, 2.1 – 2.10. — [Drills](drills/02-config-and-security.md)
- [ ] **checkpoint** Checkpoint: from memory, run a Deployment as non-root with all capabilities dropped and NET_BIND_SERVICE added, using a custom ServiceAccount and a Secret mounted as env.

## Week 4 — Deployments, Helm & Kustomize

_Domain: Application Deployment_

**Goal:** Roll out, roll back and package applications, and recognise deployment strategies even when the task doesn't name them.

- [ ] **learn** Rolling updates: strategy, maxSurge/maxUnavailable, `set image`, `rollout status/history/undo --to-revision/pause/resume/restart`. **[high yield]** — [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [ ] **learn** Blue/green (switch a Service selector) and canary (shared label + replica ratio). Practise spotting them from a description alone. **[high yield]** — [Canary docs](https://kubernetes.io/docs/concepts/workloads/management/)
- [ ] **learn** Helm: repo add/update, search, install with `--set` / `-f`, upgrade, rollback, history, list -A, uninstall, template, show values. **[high yield]** — [Notes](notes/10-helm.md) · [Using Helm](https://helm.sh/docs/intro/using_helm/)
- [ ] **learn** Kustomize: base + overlays, namespace/namePrefix/labels, images, replicas, patches, generators, `kubectl apply -k` vs `kubectl kustomize`. — [Notes](notes/11-kustomize.md) · [Docs](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [ ] **drill** Drills: Application Deployment, 3.1 – 3.8. — [Drills](drills/03-deployment.md)
- [ ] **checkpoint** Checkpoint: change an image, watch the rollout, roll back to a specific revision, then upgrade and roll back a Helm release. No docs.

## Week 5 — Networking & observability

_Domain: Services and Networking · Application Observability and Maintenance_

**Goal:** Expose applications end to end, restrict traffic, and debug anything that doesn't work.

- [ ] **learn** Services: ClusterIP, NodePort, LoadBalancer, headless, and port vs targetPort vs nodePort. Troubleshoot empty endpoints (selector or port mismatch). **[high yield]** — [Notes](notes/07-network.md)
- [ ] **learn** Ingress: ingressClassName, host and path rules, pathType (Prefix/Exact), TLS, default backend. Chain Deployment → Service → Ingress. **[high yield]** — [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [ ] **learn** NetworkPolicies: default deny, allow from pod / namespace / ipBlock, egress with DNS, and how podSelector and namespaceSelector combine (AND vs OR). **[high yield]** — [NetworkPolicies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [ ] **learn** Probes: liveness, readiness and startup with exec / httpGet / tcpSocket, and their timing fields. **[high yield]** — [Notes](notes/05-observability.md) · [Docs](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [ ] **learn** Debugging: describe, events (sorted), logs (`-c`, `-p`, `-f`, `-l`), exec, `kubectl debug`, `kubectl top`, and a temporary curl/busybox Pod. — [Debug apps](https://kubernetes.io/docs/tasks/debug/debug-application/)
- [ ] **learn** API deprecations: `kubectl api-resources`, `kubectl explain`, the deprecation guide. Update a manifest that uses a removed API version. — [Deprecation guide](https://kubernetes.io/docs/reference/using-api/deprecation-guide/)
- [ ] **drill** Drills: Services and Networking, 4.1 – 4.8. — [Drills](drills/04-services-and-networking.md)
- [ ] **drill** Drills: Observability and Maintenance, 5.1 – 5.7. — [Drills](drills/05-observability.md)
- [ ] **checkpoint** Checkpoint: in under 8 minutes, expose a Deployment through a Service and an Ingress on a host and path, and allow traffic only from Pods labelled `role=frontend`.

## Week 6 — Speed & mixed practice

**Goal:** Turn knowledge into speed. Tasks in the exam mix domains, so practise them mixed.

- [ ] **drill** Mixed exam-style scenarios, timed. Every one solved within its target time. — [Scenarios](drills/06-mixed-scenarios.md)
- [ ] **practice** Your course's practice tests / mock exams, timed, in exam conditions.
- [ ] **practice** Sweep the community CKAD exercises. Skip what's out of scope and drill what you hesitate on. — [CKAD-exercises](https://github.com/dgkanatsios/CKAD-exercises)
- [ ] **practice** Docs navigation drill: find the example YAML for Ingress, NetworkPolicy, PVC, probes, SecurityContext and CronJob in under 30s each. — [kubernetes.io/docs](https://kubernetes.io/docs/home/)
- [ ] **practice** Clear your redo list. Every failed drill solved twice, cleanly.
- [ ] **practice** Write your own one-page cheat sheet by hand. Writing it is how you memorise it. — [Reference](CHEATSHEET.md)

## Week 7 — Exam simulation #1

**Goal:** Find your real weak spots under exam pressure, then fix them.

- [ ] **mock** killer.sh session 1: the full 2 hours in one sitting, exam rules, no notes, allowed docs only. — [killer.sh](https://killer.sh/ckad)
- [ ] **practice** Within the 36h access window, go through every solution, including the ones you got right. There's often a faster way.
- [ ] **practice** Redo every question you lost points on, from scratch, in the same environment.
- [ ] **practice** Remediation: go back to the notes and drills for the 2 weakest domains.
- [ ] **mock** One more timed mock (course or mixed scenarios) to confirm the fixes.

## Week 8 — Simulation #2 & exam

**Goal:** Confirm you're ready, prepare the environment, and walk in rested.

- [ ] **mock** killer.sh session 2 (a different question set): full 2 hours, exam rules. — [killer.sh](https://killer.sh/ckad)
- [ ] **practice** Review and redo every lost point.
- [ ] **checkpoint** Every readiness gate below is green. If one isn't, reschedule. Don't gamble.
- [ ] **setup** Do the exam environment check: system check, PSI Secure Browser, one keyboard layout, layout-switch hotkeys disabled, clean desk, ID. — [Exam day](EXAM-DAY.md)
- [ ] **practice** Last 48 hours: only light review (cheat sheet + redo list). No new topics.
- [ ] **exam** Take the exam. — [Exam-day playbook](EXAM-DAY.md)

## Readiness gates

Book or keep your date only when every gate is green.

- [ ] Finished a full killer.sh session within 2 hours with at least ~80% of the points. It's a rule of thumb, not an official threshold.
- [ ] Every drill in this repo solved without notes within its target time.
- [ ] Deployment → Service → Ingress + NetworkPolicy end to end in under 8 minutes.
- [ ] set image / rollout undo / helm upgrade / helm rollback without hesitating.
- [ ] Can find any example YAML in the allowed docs in under 30 seconds.
- [ ] Can build, tag and export an image with docker or podman without looking anything up.
- [ ] The exam environment check is done and your system passes.
