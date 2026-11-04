# Drills — Application Design and Build (20%)

Container images, workload resources, multi-container Pods, volumes. Theory: [core concepts](../notes/02-core-concepts.md), [multi-container Pods](../notes/04-multi-container-pods.md), [pod design](../notes/06-pod-design.md), [state persistence](../notes/08-state-persistence.md).

```bash
k create ns d1 && k config set-context --current --namespace=d1
```

---

### 1.1 Pod in one line · ⏱ 1 min · High yield

Create a Pod `web` with image `nginx:1.27`, label `tier=web`, container port `80`.

<details><summary>Solution</summary>

```bash
k run web --image=nginx:1.27 --labels=tier=web --port=80
k get pod web --show-labels
```
</details>

### 1.2 Generate, edit, apply · ⏱ 3 min · High yield

Create a Pod `worker` (image `busybox:1.36`) that runs `sleep 3600`, has the env var `MODE=batch`, and requests `100m` CPU and `64Mi` memory. Save the manifest to `/tmp/worker.yaml` before applying it.

<details><summary>Solution</summary>

`kubectl run` has no flags for requests, so generate the YAML and add them by hand:

```bash
k run worker --image=busybox:1.36 --env=MODE=batch $do -- sleep 3600 > /tmp/worker.yaml
vim /tmp/worker.yaml
```

```yaml
    resources:
      requests:
        cpu: 100m
        memory: 64Mi
```

```bash
k apply -f /tmp/worker.yaml
k get pod worker -o jsonpath='{.spec.containers[0].resources}{"\n"}'
```
</details>

### 1.3 Find a field with `kubectl explain` · ⏱ 2 min

Without opening a browser, find the Pod field that controls how long containers get to shut down gracefully. Create Pod `quick` (image `nginx:1.27`) with it set to `5` seconds.

<details><summary>Solution</summary>

```bash
k explain pod.spec | grep -i -A3 grace        # terminationGracePeriodSeconds
k run quick --image=nginx:1.27 $do > quick.yaml
# add under spec:  terminationGracePeriodSeconds: 5
k apply -f quick.yaml
k get pod quick -o jsonpath='{.spec.terminationGracePeriodSeconds}{"\n"}'
```
</details>

### 1.4 Build, tag, export an image · ⏱ 4 min · High yield

In an empty directory `~/img`, create a `Dockerfile` that starts from `nginx:1.27-alpine` and replaces `/usr/share/nginx/html/index.html` with a file containing `v1`. Build it as `shop:v1`, add the extra tag `shop:latest`, and export the image as a tar archive to `~/img/shop-v1.tar`. Do it with podman, then again with docker.

<details><summary>Solution</summary>

```bash
mkdir -p ~/img && cd ~/img
echo v1 > index.html
cat > Dockerfile <<'EOF'
FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/index.html
EOF

podman build -t shop:v1 .
podman tag shop:v1 shop:latest
podman save -o shop-v1.tar shop:v1        # add --format oci-archive if an OCI archive is requested
podman images | grep shop

# Identical with docker:
docker build -t shop:v1 . && docker tag shop:v1 shop:latest && docker save -o shop-v1.tar shop:v1
```

Check: `tar -tf shop-v1.tar | head` lists the layers and a manifest.
</details>

### 1.5 Modify an image and push it · ⏱ 4 min · High yield

Change the Dockerfile from 1.4 so the page says `v2` and the image sets `ENV APP_VERSION=2`. Build it as `localhost:5000/shop:v2` and push it to the local registry.

Setup: `podman run -d -p 5000:5000 --name registry registry:2` (or the docker equivalent).

<details><summary>Solution</summary>

```bash
cd ~/img && echo v2 > index.html
cat > Dockerfile <<'EOF'
FROM nginx:1.27-alpine
ENV APP_VERSION=2
COPY index.html /usr/share/nginx/html/index.html
EOF

podman build -t localhost:5000/shop:v2 .
podman push localhost:5000/shop:v2 --tls-verify=false     # plain-HTTP local registry
curl -s localhost:5000/v2/shop/tags/list                    # {"name":"shop","tags":["v2"]}
```

docker: `docker build -t localhost:5000/shop:v2 . && docker push localhost:5000/shop:v2`. Docker treats `localhost` registries as insecure by default.
</details>

### 1.6 Labels and selectors · ⏱ 2 min

Create the Pods `a` (`env=dev`), `b` (`env=qa`) and `c` (`env=prod`), all `nginx:1.27`. In one command each: list only dev+qa Pods; add `owner=team-x` to every Pod that isn't prod; change `c` to `env=staging`.

<details><summary>Solution</summary>

```bash
for p in a:dev b:qa c:prod; do k run ${p%%:*} --image=nginx:1.27 -l env=${p##*:}; done
k get pods -l 'env in (dev,qa)'
k label pods -l 'env!=prod' owner=team-x
k label pod c env=staging --overwrite
k get pods -L env,owner
```
</details>

### 1.7 Job with parallelism · ⏱ 3 min · High yield

Create a Job `batch` (image `busybox:1.36`, command `echo processed`) that has to complete 6 times, runs at most 2 Pods at a time, retries a failed Pod at most 2 times, fails if it takes longer than 120 seconds, and is deleted automatically 300 seconds after it finishes.

<details><summary>Solution</summary>

```bash
k create job batch --image=busybox:1.36 $do -- echo processed > job.yaml
```

```yaml
spec:
  completions: 6
  parallelism: 2
  backoffLimit: 2
  activeDeadlineSeconds: 120
  ttlSecondsAfterFinished: 300
  template:
    ...
```

```bash
k apply -f job.yaml && k get job batch -w      # COMPLETIONS 6/6
```
</details>

### 1.8 CronJob + manual trigger · ⏱ 3 min · High yield

Create a CronJob `report` (image `busybox:1.36`, command `date`) that runs every 15 minutes, never runs two Jobs at the same time, and keeps 2 successful and 1 failed Job. Then trigger it once by hand, without waiting for the schedule.

<details><summary>Solution</summary>

```bash
k create cronjob report --image=busybox:1.36 --schedule='*/15 * * * *' $do -- date > cj.yaml
```

```yaml
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 2
  failedJobsHistoryLimit: 1
  jobTemplate: ...
```

```bash
k apply -f cj.yaml
k create job report-manual --from=cronjob/report
k logs job/report-manual
```
</details>

### 1.9 Init container prepares content · ⏱ 4 min · High yield

Create a Pod `site` that serves a page generated at startup. An init container (`busybox:1.36`) writes `hello from init` to `index.html` on a shared `emptyDir`. The main container (`nginx:1.27`) serves that volume from `/usr/share/nginx/html`.

<details><summary>Solution</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: site
spec:
  volumes:
  - name: html
    emptyDir: {}
  initContainers:
  - name: gen
    image: busybox:1.36
    command: ["sh", "-c", "echo 'hello from init' > /work/index.html"]
    volumeMounts:
    - name: html
      mountPath: /work
  containers:
  - name: web
    image: nginx:1.27
    volumeMounts:
    - name: html
      mountPath: /usr/share/nginx/html
```

```bash
k apply -f site.yaml
k exec site -c web -- curl -s localhost      # hello from init
```
</details>

### 1.10 Log-shipping sidecar · ⏱ 5 min · High yield

Pod `app`: the main container (`busybox:1.36`) appends the date to `/var/log/app/app.log` every 2 seconds. Add a **native sidecar** named `shipper` (`busybox:1.36`) that streams that file to its stdout, so `kubectl logs app -c shipper` shows the lines. The sidecar must start before the main container and keep running.

<details><summary>Solution</summary>

A native sidecar is an init container with `restartPolicy: Always`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  volumes:
  - name: logs
    emptyDir: {}
  initContainers:
  - name: shipper
    image: busybox:1.36
    restartPolicy: Always
    command: ["sh", "-c", "touch /var/log/app/app.log; tail -F /var/log/app/app.log"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  containers:
  - name: main
    image: busybox:1.36
    command: ["sh", "-c", "while true; do date >> /var/log/app/app.log; sleep 2; done"]
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
```

```bash
k apply -f app.yaml && k logs app -c shipper -f
```

If the task says "add a sidecar container" without saying *native*, a second entry under `containers:` is also accepted. Read the wording.
</details>

### 1.11 PV → PVC → Pod · ⏱ 5 min · High yield

Create a PersistentVolume `data-pv` (1Gi, `ReadWriteOnce`, hostPath `/mnt/data`, storageClassName `manual`). Create a PVC `data-pvc` requesting 500Mi that binds to it. Mount it in Pod `store` (`nginx:1.27`) at `/data`.

<details><summary>Solution</summary>

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: data-pv
spec:
  capacity:
    storage: 1Gi
  accessModes: ["ReadWriteOnce"]
  storageClassName: manual
  hostPath:
    path: /mnt/data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-pvc
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: manual
  resources:
    requests:
      storage: 500Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: store
spec:
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: data-pvc
  containers:
  - name: web
    image: nginx:1.27
    volumeMounts:
    - name: data
      mountPath: /data
```

```bash
k apply -f storage.yaml
k get pv,pvc          # both Bound; the PVC shows the PV's capacity (1Gi)
```

A PVC binds only when storageClassName and access modes match and the PV is large enough. If it stays `Pending`, `k describe pvc` tells you why.
</details>

### 1.12 Pick the right workload · ⏱ 4 min

A log agent (`busybox:1.36`, `sleep 3600`) must run exactly one Pod on every node, and when nodes are added it must start there automatically. Create it as `node-agent`.

<details><summary>Solution</summary>

That's a DaemonSet. There's no `kubectl create daemonset`, so generate a Deployment and convert it:

```bash
k create deploy node-agent --image=busybox:1.36 $do -- sleep 3600 > ds.yaml
# vim: kind: Deployment → DaemonSet; delete replicas, strategy and status
k apply -f ds.yaml
k get ds node-agent      # DESIRED = number of schedulable nodes
```

Quick map: stateless app → Deployment · one per node → DaemonSet · stable identity/storage → StatefulSet · run to completion → Job · on a schedule → CronJob.
</details>

---

Clean up: `k delete ns d1`
