# Mixed scenarios — exam style

Real exam tasks mix domains and come with exact names, namespaces and file paths. These scenarios do the same. Do them in **Week 6**, timed, one after the other, as a 40-minute block.

Exam habits to practise on every one:

1. Read the whole task first. Note every name, namespace, port and path.
2. Switch to the right context / `ssh` to the right host. The task tells you which.
3. Use the **exact** names and paths given. A typo means zero points.
4. Verify at the end (`k get`, `k describe`, a curl from a test Pod) before moving on.

---

### M1 · Ship it end to end · ⏱ 8 min

In namespace `store` (create it):

1. Deployment `frontend`, image `nginx:1.27`, 3 replicas, label `app=frontend`, container port 80.
2. Service `frontend` of type ClusterIP on port 80.
3. Ingress `frontend` (class `nginx`) for host `store.example.com`, path `/` (Prefix) → `frontend:80`.
4. A NetworkPolicy `frontend-ingress` so that `frontend` Pods accept traffic on port 80 **only** from Pods in namespaces labelled `kubernetes.io/metadata.name=ingress-nginx`.

<details><summary>Solution</summary>

```bash
k create ns store
k -n store create deploy frontend --image=nginx:1.27 --replicas=3 --port=80
k -n store expose deploy frontend --port=80
k -n store create ingress frontend --class=nginx --rule="store.example.com/*=frontend:80"
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-ingress
  namespace: store
spec:
  podSelector:
    matchLabels: { app: frontend }
  policyTypes: ["Ingress"]
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx
    ports:
    - protocol: TCP
      port: 80
```

```bash
k -n store get deploy,svc,ingress,netpol
k -n store get endpointslices -l kubernetes.io/service-name=frontend   # 3 endpoints
```

`kubernetes.io/metadata.name` is set automatically on every namespace, so you can always select a namespace by name.
</details>

### M2 · New image, new rollout · ⏱ 8 min

On the image-build host:

1. In `~/m2`, write a Dockerfile based on `nginx:1.27-alpine` whose page says `release 2`.
2. Build it as `store/frontend:2.0` and save it as an OCI archive to `~/m2/frontend-2.0.tar`.
3. In namespace `store`, update Deployment `frontend` (from M1) to image `nginx:1.27-alpine` (the practice cluster can't pull your local build, so use the public tag), annotate the change cause `release 2.0`, and wait for the rollout.
4. The release is bad. Roll it back and confirm the image is `nginx:1.27` again.

<details><summary>Solution</summary>

```bash
mkdir -p ~/m2 && cd ~/m2 && echo 'release 2' > index.html
printf 'FROM nginx:1.27-alpine\nCOPY index.html /usr/share/nginx/html/index.html\n' > Dockerfile
podman build -t store/frontend:2.0 .
podman save --format oci-archive -o ~/m2/frontend-2.0.tar store/frontend:2.0

k -n store set image deploy/frontend nginx=nginx:1.27-alpine
k -n store annotate deploy/frontend kubernetes.io/change-cause="release 2.0"
k -n store rollout status deploy/frontend
k -n store rollout undo deploy/frontend
k -n store get deploy frontend -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```
</details>

### M3 · Secure the payments API · ⏱ 10 min

In namespace `pay` (create it):

1. Secret `pay-key` with key `API_KEY=k-123`.
2. ServiceAccount `pay-sa`.
3. Deployment `pay-api` (`busybox:1.36` running `sleep 3600`, 2 replicas) that:
   - runs with `pay-sa` and does **not** automount the API token,
   - exposes the secret as env var `API_KEY`,
   - requests `100m`/`64Mi` and is limited to `250m`/`128Mi`,
   - runs its container with `allowPrivilegeEscalation: false` and drops all capabilities.
4. A Role + RoleBinding so `pay-sa` can only `get` the Secret `pay-key`, and nothing else.

<details><summary>Solution</summary>

```bash
k create ns pay
k -n pay create secret generic pay-key --from-literal=API_KEY=k-123
k -n pay create sa pay-sa
k -n pay create deploy pay-api --image=busybox:1.36 --replicas=2 $do -- sleep 3600 > pay.yaml
```

```yaml
    spec:
      serviceAccountName: pay-sa
      automountServiceAccountToken: false
      containers:
      - name: busybox
        image: busybox:1.36
        command: ["sleep", "3600"]
        env:
        - name: API_KEY
          valueFrom:
            secretKeyRef: { name: pay-key, key: API_KEY }
        resources:
          requests: { cpu: 100m, memory: 64Mi }
          limits:   { cpu: 250m, memory: 128Mi }
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
```

```bash
k apply -f pay.yaml
k -n pay create role pay-secret-reader --verb=get --resource=secrets --resource-name=pay-key
k -n pay create rolebinding pay-sa-secret --role=pay-secret-reader --serviceaccount=pay:pay-sa
k -n pay auth can-i get secret/pay-key --as=system:serviceaccount:pay:pay-sa    # yes
k -n pay auth can-i list secrets --as=system:serviceaccount:pay:pay-sa          # no
k -n pay get pods                                                              # 2 Pods Running
k -n pay exec deploy/pay-api -- sh -c 'echo $API_KEY; ls /var/run/secrets/kubernetes.io 2>&1'   # k-123, then "No such file" (no token)
```

Watch out when you drop **all** capabilities on images that start as root and bind low ports (the stock `nginx`, for example): they can crash. When that happens, `k logs` tells you which capability is missing.
</details>

### M4 · Nightly export to storage · ⏱ 8 min

In namespace `ops` (create it):

1. PVC `exports` (1Gi, `ReadWriteOnce`, the cluster's default StorageClass).
2. CronJob `export` that runs at 01:30 every day, never overlaps with itself, keeps 3 successful Jobs, and runs `busybox:1.36` with `sh -c 'date >> /exports/log.txt'` with the PVC mounted at `/exports`.
3. Trigger one run by hand as Job `export-now` and prove the file was written.

<details><summary>Solution</summary>

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: exports
  namespace: ops
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: export
  namespace: ops
spec:
  schedule: "30 1 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          volumes:
          - name: exports
            persistentVolumeClaim:
              claimName: exports
          containers:
          - name: export
            image: busybox:1.36
            command: ["sh", "-c", "date >> /exports/log.txt"]
            volumeMounts:
            - name: exports
              mountPath: /exports
```

```bash
k create ns ops && k apply -f m4.yaml
k -n ops create job export-now --from=cronjob/export
k -n ops wait --for=condition=complete job/export-now --timeout=60s
k -n ops get pvc exports          # Bound
```

Leaving out `storageClassName` uses the default StorageClass. Setting `storageClassName: ""` does the opposite: it disables dynamic provisioning.
</details>

### M5 · It's broken — fix everything · ⏱ 10 min · High yield

Apply the setup. Users report that Service `catalog` in namespace `shop` doesn't answer. There are **three** independent faults. Fix them all without deleting the Service.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shop
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels: { app: catalog }
  template:
    metadata:
      labels: { app: catalog }
    spec:
      containers:
      - name: web
        image: nginx:1.27-typo
        readinessProbe:
          httpGet: { path: /, port: 8080 }
---
apiVersion: v1
kind: Service
metadata:
  name: catalog
  namespace: shop
spec:
  selector: { app: catalog-api }
  ports:
  - port: 80
    targetPort: 80
```

<details><summary>Solution</summary>

```bash
k -n shop get pods                                   # ImagePullBackOff → fault 1: image tag
k -n shop set image deploy/catalog web=nginx:1.27
k -n shop get pods                                   # Running but 0/1 READY → fault 2: probe port
k -n shop patch deploy catalog --type=json \
  -p '[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/port","value":80}]'
k -n shop get endpointslices -l kubernetes.io/service-name=catalog   # no endpoints → fault 3: selector
k -n shop patch svc catalog -p '{"spec":{"selector":{"app":"catalog"}}}'
k -n shop run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 catalog | head -4
```

Always follow the chain **Pod running → Pod ready → Service endpoints → port**. Every link has its own check.
</details>

### M6 · Upgrade a Helm release with a values file · ⏱ 7 min

1. Install chart `podinfo/podinfo` (repo `https://stefanprodan.github.io/podinfo`) as release `info` in namespace `apps` with defaults.
2. Write `~/info-values.yaml` that sets `replicaCount: 3` and `ui.message: "from values"`, and upgrade the release with it.
3. Save the rendered manifests of the current release to `~/info-manifest.yaml`.
4. Roll back to revision 1 and confirm there is 1 replica again.

<details><summary>Solution</summary>

```bash
helm repo add podinfo https://stefanprodan.github.io/podinfo && helm repo update
helm install info podinfo/podinfo -n apps --create-namespace
cat > ~/info-values.yaml <<'EOF'
replicaCount: 3
ui:
  message: "from values"
EOF
helm upgrade info podinfo/podinfo -n apps -f ~/info-values.yaml
helm get manifest info -n apps > ~/info-manifest.yaml
helm rollback info 1 -n apps
k -n apps get deploy                 # 1/1
helm history info -n apps            # 3 revisions: install, upgrade, rollback
```
</details>

---

Clean up: `k delete ns store pay ops shop apps`
