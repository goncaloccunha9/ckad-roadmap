# Drills — Application Environment, Configuration and Security (25%)

The heaviest domain. Theory: [configuration](../notes/03-configuration.md), [security](../notes/09-security.md).

```bash
k create ns d2 && k config set-context --current --namespace=d2
```

---

### 2.1 ConfigMap → env and envFrom · ⏱ 3 min · High yield

Create a ConfigMap `app-cfg` with `LOG_LEVEL=debug` and `FEATURE_X=on`. Create a Pod `cfg-env` (`busybox:1.36`, `sleep 3600`) that loads **all** keys as env vars and also exposes `LOG_LEVEL` under the name `APP_LOG`.

<details><summary>Solution</summary>

```bash
k create cm app-cfg --from-literal=LOG_LEVEL=debug --from-literal=FEATURE_X=on
k run cfg-env --image=busybox:1.36 $do -- sleep 3600 > cfg-env.yaml
```

```yaml
  containers:
  - name: cfg-env
    image: busybox:1.36
    args: ["sleep", "3600"]
    envFrom:
    - configMapRef:
        name: app-cfg
    env:
    - name: APP_LOG
      valueFrom:
        configMapKeyRef:
          name: app-cfg
          key: LOG_LEVEL
```

```bash
k apply -f cfg-env.yaml && k exec cfg-env -- env | grep -E 'LOG|FEATURE'
```
</details>

### 2.2 ConfigMap as a file · ⏱ 4 min · High yield

Create the file `app.properties` containing `color=blue` and turn it into ConfigMap `props`. Mount **only that key** as `/etc/app/app.properties` in Pod `cfg-file` (`nginx:1.27`), without hiding anything else that's in `/etc/app`.

<details><summary>Solution</summary>

```bash
echo color=blue > app.properties
k create cm props --from-file=app.properties
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cfg-file
spec:
  volumes:
  - name: props
    configMap:
      name: props
  containers:
  - name: web
    image: nginx:1.27
    volumeMounts:
    - name: props
      mountPath: /etc/app/app.properties
      subPath: app.properties
```

```bash
k exec cfg-file -- cat /etc/app/app.properties
```

`subPath` mounts a single file instead of the whole directory. The catch: subPath mounts don't pick up later ConfigMap updates.
</details>

### 2.3 Secret → env and read-only volume · ⏱ 4 min · High yield

Create a generic Secret `db-cred` with `user=app` and `password=S3cr3t!`. Pod `db-client` (`busybox:1.36`, `sleep 3600`) gets the password in the env var `DB_PASSWORD` and mounts the whole Secret at `/etc/db` with file mode `0400`.

<details><summary>Solution</summary>

```bash
k create secret generic db-cred --from-literal=user=app --from-literal='password=S3cr3t!'
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-client
spec:
  volumes:
  - name: cred
    secret:
      secretName: db-cred
      defaultMode: 0400
  containers:
  - name: c
    image: busybox:1.36
    command: ["sleep", "3600"]
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-cred
          key: password
    volumeMounts:
    - name: cred
      mountPath: /etc/db
      readOnly: true
```

```bash
k exec db-client -- sh -c 'echo $DB_PASSWORD; ls -lL /etc/db'
```
</details>

### 2.4 Read a Secret · ⏱ 1 min

Write the decoded value of `password` in Secret `db-cred` to `/tmp/pw.txt`.

<details><summary>Solution</summary>

```bash
k get secret db-cred -o jsonpath='{.data.password}' | base64 -d > /tmp/pw.txt
cat /tmp/pw.txt
```
</details>

### 2.5 Requests, limits and a quota · ⏱ 5 min · High yield

In a new namespace `quota-lab`, create ResourceQuota `team-quota`: at most 5 Pods, `requests.cpu=1`, `requests.memory=1Gi`, `limits.cpu=2`, `limits.memory=2Gi`. Then try `k run bare --image=nginx:1.27`, explain the error, and fix it by creating Pod `bare` in `quota-lab` with requests `100m`/`128Mi` and limits `200m`/`256Mi`.

<details><summary>Solution</summary>

```bash
k create ns quota-lab && k config set-context --current --namespace=quota-lab
k create quota team-quota --hard=pods=5,requests.cpu=1,requests.memory=1Gi,limits.cpu=2,limits.memory=2Gi
k run bare --image=nginx:1.27
# Error: forbidden: failed quota: team-quota: must specify limits.cpu, limits.memory, requests.cpu, requests.memory
k run bare --image=nginx:1.27 $do > bare.yaml
```

```yaml
    resources:
      requests: { cpu: 100m, memory: 128Mi }
      limits:   { cpu: 200m, memory: 256Mi }
```

```bash
k apply -f bare.yaml && k describe quota team-quota
k config set-context --current --namespace=d2      # back to d2 for the rest
```

Once a quota covers CPU and memory, every new Pod has to declare those values or get them from a LimitRange.
</details>

### 2.6 Defaults with a LimitRange · ⏱ 4 min

In `d2`, make every container that doesn't declare resources default to requests `50m`/`64Mi` and limits `100m`/`128Mi`. Prove it with a Pod `defaulted` that sets no resources.

<details><summary>Solution</summary>

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: defaults
spec:
  limits:
  - type: Container
    defaultRequest:
      cpu: 50m
      memory: 64Mi
    default:
      cpu: 100m
      memory: 128Mi
```

```bash
k apply -f lr.yaml
k run defaulted --image=nginx:1.27
k get pod defaulted -o jsonpath='{.spec.containers[0].resources}{"\n"}'
```

LimitRanges only apply when a Pod is created. Existing Pods don't change.
</details>

### 2.7 Hardened Pod · ⏱ 5 min · High yield

Pod `hardened` (`busybox:1.36`, `sleep 3600`): runs as user `1000`, group `3000`, volumes owned by fsGroup `2000`; the container can't escalate privileges, has a read-only root filesystem, drops **all** capabilities and adds only `NET_BIND_SERVICE`. Give it a writable `emptyDir` at `/tmp`.

<details><summary>Solution</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened
spec:
  securityContext:              # Pod level: users, groups, fsGroup
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  volumes:
  - name: tmp
    emptyDir: {}
  containers:
  - name: c
    image: busybox:1.36
    command: ["sleep", "3600"]
    securityContext:            # container level: capabilities and filesystem
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
```

```bash
k exec hardened -- id                     # uid=1000 gid=3000 groups=2000,...
k exec hardened -- touch /root-test       # Read-only file system
k exec hardened -- touch /tmp/ok && echo writable
```

`capabilities`, `allowPrivilegeEscalation` and `readOnlyRootFilesystem` exist **only** at container level. `fsGroup` exists only at Pod level.
</details>

### 2.8 ServiceAccount on a Deployment · ⏱ 2 min · High yield

Create ServiceAccount `deployer`. Create Deployment `tool` (`nginx:1.27`) and make it run with `deployer`.

<details><summary>Solution</summary>

```bash
k create sa deployer
k create deploy tool --image=nginx:1.27
k set serviceaccount deploy/tool deployer
k get pod -l app=tool -o jsonpath='{.items[*].spec.serviceAccountName}{"\n"}'
```
</details>

### 2.9 Least-privilege RBAC · ⏱ 4 min · High yield

Allow ServiceAccount `deployer` in `d2` to `get`, `list` and `watch` Pods and to `update` Deployments, in this namespace only. Prove it can list Pods but can't delete them.

<details><summary>Solution</summary>

```bash
k create role pod-reader --verb=get,list,watch --resource=pods
k create role deploy-updater --verb=update --resource=deployments.apps
k create rolebinding deployer-pods --role=pod-reader --serviceaccount=d2:deployer
k create rolebinding deployer-deploys --role=deploy-updater --serviceaccount=d2:deployer

k auth can-i list pods --as=system:serviceaccount:d2:deployer -n d2          # yes
k auth can-i delete pods --as=system:serviceaccount:d2:deployer -n d2        # no
k auth can-i update deployments --as=system:serviceaccount:d2:deployer -n d2 # yes
```

A single Role with two rules works just as well. Edit the YAML if you prefer.
</details>

### 2.10 Use an existing CRD · ⏱ 4 min

A CRD for `Backup` objects is installed (apply the setup below). Find out its group, version and required fields without opening the YAML, then create a `Backup` named `nightly` with schedule `0 2 * * *` and `retention: 7`.

Setup:

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.ops.example.com
spec:
  group: ops.example.com
  scope: Namespaced
  names:
    plural: backups
    singular: backup
    kind: Backup
    shortNames: ["bk"]
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["schedule"]
            properties:
              schedule:
                type: string
              retention:
                type: integer
```

<details><summary>Solution</summary>

```bash
k get crd | grep backup
k api-resources | grep -i backup         # NAME, SHORTNAMES, APIVERSION ops.example.com/v1
k explain backup.spec                    # schedule (required), retention
```

```yaml
apiVersion: ops.example.com/v1
kind: Backup
metadata:
  name: nightly
spec:
  schedule: "0 2 * * *"
  retention: 7
```

```bash
k apply -f nightly.yaml && k get bk
```
</details>

---

Clean up: `k delete ns d2 quota-lab && k delete crd backups.ops.example.com`
