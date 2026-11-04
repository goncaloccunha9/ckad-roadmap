# Drills — Application Deployment (20%)

Rolling updates, rollbacks, deployment strategies, Helm, Kustomize. Theory: [pod design](../notes/06-pod-design.md), [Helm](../notes/10-helm.md), [Kustomize](../notes/11-kustomize.md).

```bash
k create ns d3 && k config set-context --current --namespace=d3
```

---

### 3.1 Deployment with a safe rollout strategy · ⏱ 3 min · High yield

Create Deployment `api` (`nginx:1.26`, 4 replicas). During updates it must never have fewer than 4 Pods available and never more than 5 in total.

<details><summary>Solution</summary>

```bash
k create deploy api --image=nginx:1.26 --replicas=4
k patch deploy api -p '{"spec":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":1,"maxUnavailable":0}}}}'
k get deploy api -o jsonpath='{.spec.strategy}{"\n"}'
```

Editing it in `k edit deploy api` works just as well. Use whichever is faster for you.
</details>

### 3.2 Update the image and record why · ⏱ 2 min · High yield

Update `api` to `nginx:1.27`, record the change cause `upgrade to 1.27`, wait for the rollout to finish, and show the history.

<details><summary>Solution</summary>

```bash
k set image deploy/api nginx=nginx:1.27                 # container name = nginx (from `k create deploy`)
k annotate deploy/api kubernetes.io/change-cause="upgrade to 1.27"
k rollout status deploy/api
k rollout history deploy/api
```

Don't know the container name? `k get deploy api -o jsonpath='{.spec.template.spec.containers[*].name}'`.
</details>

### 3.3 Recover from a broken rollout · ⏱ 3 min · High yield

Someone set `api` to image `nginx:1.27-doesnotexist`. Find out why new Pods don't start, then roll back to the revision that runs `nginx:1.26`. Not just the previous one: that exact revision.

<details><summary>Solution</summary>

```bash
k set image deploy/api nginx=nginx:1.27-doesnotexist      # simulate the incident
k rollout status deploy/api --timeout=30s                 # stuck
k get pods -l app=api                                     # ErrImagePull / ImagePullBackOff
k rollout history deploy/api
k rollout history deploy/api --revision=1                 # check which revision has 1.26
k rollout undo deploy/api --to-revision=1
k get deploy api -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```

Thanks to `maxUnavailable: 0` from 3.1, the old Pods kept serving during the incident.
</details>

### 3.4 Batch several changes into one rollout · ⏱ 3 min

Pause `api`, change the image to `nginx:1.27` **and** set memory limit `128Mi`, then resume it so both changes go out in a single rollout.

<details><summary>Solution</summary>

```bash
k rollout pause deploy/api
k set image deploy/api nginx=nginx:1.27
k set resources deploy/api -c nginx --limits=memory=128Mi
k rollout resume deploy/api
k rollout status deploy/api && k rollout history deploy/api   # one new revision
```
</details>

### 3.5 Blue/green switch · ⏱ 5 min · High yield

Deployments `shop-blue` (`nginx:1.26`, labels `app=shop,version=blue`) and `shop-green` (`nginx:1.27`, labels `app=shop,version=green`), 2 replicas each. Service `shop` (port 80) sends all traffic to blue. Switch all traffic to green in one command, with no downtime.

<details><summary>Solution</summary>

```bash
for c in blue:1.26 green:1.27; do
  v=${c%%:*}; t=${c##*:}
  k create deploy shop-$v --image=nginx:$t --replicas=2 $do > shop-$v.yaml
  # vim: set labels app: shop + version: $v in BOTH spec.selector.matchLabels and spec.template.metadata.labels
done
k apply -f shop-blue.yaml -f shop-green.yaml
k create svc clusterip shop --tcp=80:80 $do > svc.yaml
# vim: selector → app: shop, version: blue
k apply -f svc.yaml

k patch svc shop -p '{"spec":{"selector":{"app":"shop","version":"green"}}}'
k get endpointslices -l kubernetes.io/service-name=shop -o wide      # only the green Pod IPs
```
</details>

### 3.6 The strategy that isn't named · ⏱ 5 min · High yield

> *"Service `store` currently routes to 4 Pods of `store-v1` (`nginx:1.26`). Run `nginx:1.27` as Deployment `store-v2` alongside it, so that about 20% of the requests to the existing Service reach the new version. The total number of Pods must stay at 5."*

The task never says **canary**, but that's what it is. Recognise it, then build it.

<details><summary>Solution</summary>

The Service selects only the shared label (`app=store`). Each Deployment adds its own `version` label, so their selectors don't overlap. The replica ratio sets the traffic split: 4 + 1 = 5 Pods, with 1/5 = 20% on v2.

```bash
k create deploy store-v1 --image=nginx:1.26 --replicas=4 $do > v1.yaml
k create deploy store-v2 --image=nginx:1.27 --replicas=1 $do > v2.yaml
# vim both: matchLabels + template labels → app: store, version: v1 | v2
k apply -f v1.yaml -f v2.yaml
k create svc clusterip store --tcp=80:80    # its default selector app=store matches both

k get pods -l app=store -L version           # 4 × v1, 1 × v2
```

Learn to spot it from the wording: "a small share of the traffic", "alongside the current version", "existing Service". A task that says "switch all traffic" is blue/green.
</details>

### 3.7 Helm lifecycle · ⏱ 6 min · High yield

Using the chart repo `https://stefanprodan.github.io/podinfo`: install chart `podinfo` as release `web` in namespace `helm-lab` (create it) with 2 replicas and UI message `hello`. Upgrade the release to set the message to `v2`. Then roll back to the first revision and list all releases in every namespace.

<details><summary>Solution</summary>

```bash
helm repo add podinfo https://stefanprodan.github.io/podinfo && helm repo update
helm search repo podinfo
helm show values podinfo/podinfo | grep -E '^replicaCount|message'   # find the value names

helm install web podinfo/podinfo -n helm-lab --create-namespace \
  --set replicaCount=2 --set ui.message=hello
helm upgrade web podinfo/podinfo -n helm-lab --reuse-values --set ui.message=v2
helm history web -n helm-lab
helm rollback web 1 -n helm-lab
helm list -A
helm get values web -n helm-lab              # replicaCount 2, message hello
```

Without `--reuse-values`, `helm upgrade` resets every value you don't pass again, so `replicaCount` would go back to the chart default.
</details>

### 3.8 Kustomize overlay · ⏱ 7 min

Given `base/` (a Deployment `web` with `nginx:1.26` + a Service `web`), create `overlays/prod` that deploys into namespace `prod`, prefixes names with `prod-`, adds label `env=prod`, runs 3 replicas, and uses image tag `1.27`. Render it first, then apply.

<details><summary>Solution</summary>

```bash
mkdir -p base overlays/prod
k create deploy web --image=nginx:1.26 $do > base/deploy.yaml
k create svc clusterip web --tcp=80:80 $do > base/svc.yaml
cat > base/kustomization.yaml <<'EOF'
resources:
- deploy.yaml
- svc.yaml
EOF

cat > overlays/prod/kustomization.yaml <<'EOF'
resources:
- ../../base
namespace: prod
namePrefix: prod-
labels:
- pairs:
    env: prod
replicas:
- name: web
  count: 3
images:
- name: nginx
  newTag: "1.27"
EOF

k kustomize overlays/prod                   # review the output first
k create ns prod
k apply -k overlays/prod
k get deploy,svc -n prod --show-labels
```

`labels` without `includeSelectors: true` leaves selectors alone, which is the safe default. The older `commonLabels` also edits selectors and is deprecated.
</details>

---

Clean up: `k delete ns d3 helm-lab prod`
