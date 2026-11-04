# CKAD cheat sheet

The commands that save the most time, on one page. Use it as a reference, but write your own version by hand in Week 6. Writing it yourself is what makes it stick.

## Setup

```bash
echo 'set ts=2 sw=2 et ai nu' >> ~/.vimrc
export do="--dry-run=client -o yaml"
export now="--grace-period=0 --force"
k config set-context --current --namespace=<ns>   # or pass -n on every command
```

**vim:** `dd` delete line · `yy`/`p` copy/paste line · `u` undo · `V` + `>`/`<` indent block · `:set paste` before pasting from docs · `/text` search · `:wq` save & quit

## Generate instead of typing

| Need | Command |
|---|---|
| Pod | `k run web --image=nginx:1.27 --port=80 -l app=web $do` |
| Pod with command | `k run job1 --image=busybox:1.36 $do -- sh -c 'echo hi; sleep 3600'` |
| Deployment | `k create deploy web --image=nginx:1.27 --replicas=3 --port=80 $do` |
| Service | `k expose deploy web --port=80 --target-port=8080 [--type=NodePort]` |
| Job / CronJob | `k create job j --image=busybox:1.36 -- date` · `k create cronjob c --image=busybox:1.36 --schedule='*/5 * * * *' -- date` |
| Job from CronJob | `k create job manual --from=cronjob/c` |
| ConfigMap | `k create cm cfg --from-literal=K=V --from-file=app.conf --from-env-file=.env` |
| Secret | `k create secret generic s --from-literal=pw=x` · `k create secret tls t --cert=c.crt --key=c.key` |
| Ingress | `k create ingress i --class=nginx --rule="host/path*=svc:80"` (`*` = Prefix) |
| SA / RBAC | `k create sa x` · `k create role r --verb=get,list --resource=pods` · `k create rolebinding rb --role=r --serviceaccount=ns:x` |
| Quota | `k create quota q --hard=pods=5,requests.cpu=1,limits.memory=2Gi` |
| Token | `k create token <sa>` |

No generator: **DaemonSet** (generate a Deployment, change `kind`, delete `replicas`/`strategy`), **PV/PVC**, **NetworkPolicy**, **LimitRange**. Copy those from the docs.

## Change running things

```bash
k set image deploy/web nginx=nginx:1.27
k set resources deploy/web -c nginx --requests=cpu=100m --limits=memory=128Mi
k set env deploy/web MODE=prod
k set serviceaccount deploy/web my-sa
k scale deploy/web --replicas=5
k label pod p tier=web --overwrite            # remove: tier-
k annotate deploy/web kubernetes.io/change-cause="why"
k patch svc s -p '{"spec":{"selector":{"app":"web"}}}'
k edit deploy/web
```

Bare Pods are mostly immutable: `k get pod p -o yaml > p.yaml` → edit → `k replace --force -f p.yaml`.

## Rollouts

```bash
k rollout status  deploy/web
k rollout history deploy/web [--revision=2]
k rollout undo    deploy/web [--to-revision=2]
k rollout pause | resume | restart deploy/web
```

## Helm

```bash
helm repo add <name> <url> && helm repo update
helm search repo <chart>            # --versions for all versions
helm show values <repo/chart>
helm install <rel> <repo/chart> -n <ns> --create-namespace --set k=v -f values.yaml
helm upgrade <rel> <repo/chart> -n <ns> --reuse-values --set k=v
helm history <rel> -n <ns> ; helm rollback <rel> <rev> -n <ns>
helm list -A ; helm get values|manifest <rel> -n <ns> ; helm uninstall <rel> -n <ns>
helm template <rel> <repo/chart> -f values.yaml > out.yaml
```

## Kustomize

```bash
k kustomize <dir>        # render
k apply -k <dir>         # apply
```

`kustomization.yaml` fields: `resources`, `namespace`, `namePrefix`, `labels`, `images`, `replicas`, `patches`, `configMapGenerator`, `secretGenerator`.

## Find things fast

```bash
k explain deploy.spec.strategy --recursive
k api-resources | grep -i <kind>                     # short names, API group, namespaced?
k get pods -A -o wide --show-labels
k get pods -l 'app in (web,api)' -L app
k get pod p -o jsonpath='{.spec.containers[*].image}'
k get events --sort-by=.lastTimestamp
k auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa> -n <ns>
```

## Debug

```bash
k describe pod p                     # Events at the bottom
k logs p [-c c] [-p] [-f] [--tail=50] [--since=10m]
k logs -l app=web --prefix
k exec -it p -- sh
k debug -it p --image=busybox:1.36 --target=<container>
k top pod -A --sort-by=cpu           # needs metrics-server
k run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 svc.ns:80
k get endpointslices -l kubernetes.io/service-name=<svc>
```

Service debug chain: **Pod Running → Pod Ready → endpoints exist → targetPort right → NetworkPolicy allows it.**

## Images (docker and podman are interchangeable)

```bash
podman build -t app:v1 .
podman tag app:v1 registry.example.com/app:v1
podman push registry.example.com/app:v1
podman save -o app.tar app:v1          # --format oci-archive for OCI
podman images ; podman run -d --name t app:v1 ; podman logs t
```
