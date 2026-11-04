# Configuration

> CKAD domain: Application Environment, Configuration and Security (25%), Application Design and Build (20%)

## Table of Contents
1. [Docker Images & Dockerfile](#docker-images--dockerfile)
2. [CMD vs ENTRYPOINT](#cmd-vs-entrypoint)
3. [Editing Pods & Deployments](#editing-pods--deployments)
4. [Environment Variables](#environment-variables)
5. [ConfigMaps](#configmaps)
6. [Secrets](#secrets)
7. [Security Contexts](#security-contexts)
8. [Resource Requests & Limits](#resource-requests--limits)
9. [LimitRange](#limitrange)
10. [ResourceQuotas](#resourcequotas)
11. [Service Accounts](#service-accounts)
12. [Taints & Tolerations](#taints--tolerations)
13. [Node Selectors](#node-selectors)
14. [Node Affinity](#node-affinity)
15. [Quick Reference](#quick-reference)

---

## Docker Images & Dockerfile

### Basic Dockerfile Flow
1. Start from a base image (an OS or another image)
2. Install all dependencies
3. Copy the source code
4. Specify the ENTRYPOINT/CMD

### Dockerfile Example
```dockerfile
FROM python:3.12-slim

RUN pip install flask mysql-connector-python

COPY . /opt/source-code

ENV FLASK_APP=/opt/source-code/app.py

ENTRYPOINT ["flask", "run", "--host=0.0.0.0"]
```

### Docker Commands
```bash
docker build -t myapp:v1 .                     # Build the image
docker push myuser/myapp:v1                     # Push to a registry
docker run myapp:v1                             # Run a container
docker run -p 8080:80 myapp:v1                  # With port mapping
docker image ls                                 # List images
docker history myapp:v1                         # Show layers
docker inspect myapp:v1                         # Image details
```

### Layered Architecture
- Each `RUN`, `COPY` and `ADD` instruction creates a **layer** (other instructions only add metadata)
- Each layer stores only the differences from the previous layer
- Layers are cached: if a build step fails, the next build reuses the layers that were already built successfully
- A change in one instruction invalidates the cache for every instruction after it, so put rarely-changing steps first
- Adding layers increases the total image size

---

## CMD vs ENTRYPOINT

### The 4 Approaches

**1. CMD only**
```dockerfile
FROM ubuntu
CMD ["sleep", "5"]
```
```bash
docker run my-sleeper          # Runs: sleep 5
docker run my-sleeper sleep 10 # Runs: sleep 10 (replaces the entire CMD)
```

**2. ENTRYPOINT only**
```dockerfile
FROM ubuntu
ENTRYPOINT ["sleep"]
```
```bash
docker run my-sleeper 10       # Runs: sleep 10
docker run my-sleeper          # ERROR: sleep with no argument
```

**3. ENTRYPOINT + CMD (recommended)**
```dockerfile
FROM ubuntu
ENTRYPOINT ["sleep"]
CMD ["5"]
```
```bash
docker run my-sleeper          # Runs: sleep 5 (CMD = default)
docker run my-sleeper 10       # Runs: sleep 10 (the argument overrides CMD)
```

**4. Overriding ENTRYPOINT at runtime**
```bash
docker run --entrypoint echo my-sleeper hello  # Runs: echo hello
```

### Docker → Kubernetes Mapping

| Docker | Kubernetes (pod spec) | Description |
|---|---|---|
| `ENTRYPOINT` | `command:` | The command to run |
| `CMD` | `args:` | Default arguments |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sleeper
spec:
  containers:
  - name: sleeper
    image: ubuntu
    command: ["sleep"]       # Overrides ENTRYPOINT
    args: ["10"]             # Overrides CMD
```

**EXAM TIP:** If the question asks you to change the command, use `command:`. If it asks you to change the arguments, use `args:`. If you set `command:` without `args:`, both the image's ENTRYPOINT and its CMD are ignored. If you set only `args:`, the image's ENTRYPOINT is kept and `args:` replaces CMD.

---

## Editing Pods & Deployments

### Editable Fields on a Running Pod
- `spec.containers[*].image`
- `spec.initContainers[*].image`
- `spec.activeDeadlineSeconds`
- `spec.tolerations` (additions only)
- `spec.terminationGracePeriodSeconds`

(Container CPU/memory resources can also be resized in place on recent versions, but this is not needed for the exam.)

### Methods for Editing Pods

**Method 1: kubectl edit**
```bash
kubectl edit pod webapp
# Make your changes → if a field is not editable, kubectl saves a temp file
kubectl delete pod webapp
kubectl create -f /tmp/kubectl-edit-xxxxx.yaml
```

**Method 2: Export, edit, replace**
```bash
kubectl get pod webapp -o yaml > my-new-pod.yaml
vim my-new-pod.yaml                    # Edit
kubectl replace --force -f my-new-pod.yaml   # Deletes and recreates
```

### Editing Deployments (much easier!)
```bash
kubectl edit deployment my-deployment
```
Any field of the pod template can be edited. The Deployment rolls out new pods automatically.

**EXAM TIP:** When you have the choice, use Deployments rather than standalone Pods. They are much easier to edit.

---

## Environment Variables

### 3 Ways to Define Them

**1. Plain value (key-value)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    env:
    - name: APP_COLOR
      value: pink
```

**2. From a ConfigMap**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    env:
    - name: APP_COLOR
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: APP_COLOR
```

**3. From a Secret**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secret
          key: DB_Password
```

---

## ConfigMaps

Decouple configuration from the pod definition. Useful when many pods share the same configuration.

### Creating a ConfigMap

**Imperative (CLI):**
```bash
# From literals
kubectl create configmap app-config \
  --from-literal=APP_COLOR=blue \
  --from-literal=APP_MODE=prod

# From a file (the key is the file name, the value is the whole file content)
kubectl create configmap app-config \
  --from-file=app_config.properties

# From an env-style file (each KEY=VALUE line becomes its own key)
kubectl create configmap app-config \
  --from-env-file=app_config.properties
```

**Declarative (YAML):**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_COLOR: blue
  APP_MODE: prod
```

### 3 Ways to Inject a ConfigMap into a Pod

**1. envFrom (all keys as env vars)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    envFrom:
    - configMapRef:
        name: app-config
```

**2. env (single key)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    env:
    - name: APP_COLOR
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: APP_COLOR
```

**3. volume (mounted as files)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    volumeMounts:
    - name: config-volume
      mountPath: /etc/config
  volumes:
  - name: config-volume
    configMap:
      name: app-config
```
Each key of the ConfigMap becomes a file in the mounted directory. Mounted files are eventually updated when the ConfigMap changes; environment variables are only read when the container starts.

### ConfigMap Commands
```bash
kubectl get configmaps              # or kubectl get cm
kubectl describe configmap app-config
kubectl get configmap app-config -o yaml
```

**EXAM TIP:** `envFrom` is the quickest way to inject a whole ConfigMap. It injects ALL keys of the ConfigMap as environment variables.

---

## Secrets

Similar to ConfigMaps but meant for sensitive data. Values are stored base64-encoded (this is not encryption!).

### Creating a Secret

**Imperative:**
```bash
kubectl create secret generic app-secret \
  --from-literal=DB_Host=mysql \
  --from-literal=DB_User=root \
  --from-literal=DB_Password=passw0rd

kubectl create secret generic app-secret \
  --from-file=app_secret.properties
```

**Declarative (base64 values):**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
data:
  DB_Host: bXlzcWw=        # echo -n 'mysql' | base64
  DB_User: cm9vdA==         # echo -n 'root' | base64
  DB_Password: cGFzc3cwcmQ= # echo -n 'passw0rd' | base64
```

### Encoding/Decoding
```bash
echo -n 'mysql' | base64              # Encode: bXlzcWw=
echo -n 'bXlzcWw=' | base64 --decode  # Decode: mysql
```

### 3 Ways to Inject a Secret into a Pod

**1. envFrom (all keys)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    envFrom:
    - secretRef:
        name: app-secret
```

**2. env (single key)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secret
          key: DB_Password
```

**3. volume (each key = a file)**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    volumeMounts:
    - name: secret-volume
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: secret-volume
    secret:
      secretName: app-secret
```

### Secret Commands
```bash
kubectl get secrets
kubectl describe secret app-secret       # Shows keys and sizes, NOT values
kubectl get secret app-secret -o yaml    # Shows values in base64
```

**EXAM TIP:** For imperative creation use `generic`, the most common type. The other `kubectl create secret` subcommands are `docker-registry` and `tls`.

**IMPORTANT NOTE:** Base64 is NOT encryption, and by default Secrets are stored unencrypted in etcd. For real protection, enable encryption at rest (an `EncryptionConfiguration` passed to the kube-apiserver with `--encryption-provider-config`) and restrict access with RBAC. Never commit Secret manifests to a Git repository.

---

## Security Contexts

### Docker Security
- Containers and the host share the same kernel
- Each container has its own process namespace
- By default, the container process runs as **root** (UID 0) inside the container, but with a limited set of capabilities

```bash
docker run --user=1001 ubuntu sleep 3600    # Run as user 1001
docker run --cap-add SYS_TIME ubuntu        # Add a capability
docker run --cap-drop KILL ubuntu           # Drop a capability
docker run --privileged ubuntu              # ALL capabilities
```

### Security Context in Kubernetes
Can be set at the **Pod level** or the **container level**. If set at both, the container setting overrides the pod setting.

**Pod level:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    runAsNonRoot: true
  containers:
  - name: myapp
    image: myapp
```

**Container level (capabilities only work here!):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  containers:
  - name: myapp
    image: myapp
    securityContext:
      runAsUser: 1000
      capabilities:
        add: ["SYS_TIME", "NET_ADMIN"]
        drop: ["KILL"]
```

**EXAM TIP:** `capabilities` ONLY work at the container level, NOT at the pod level. This is a very common mistake.

### Useful Commands
```bash
# Check which user a pod runs as
kubectl exec pod-name -- whoami
kubectl exec pod-name -- id

# Export and edit
kubectl get pod pod-name -o yaml > pod.yaml
kubectl replace --force -f pod.yaml
```

---

## Resource Requests & Limits

### Requests vs Limits
- **Requests**: The minimum resources guaranteed to the container. The scheduler uses them to decide where to place the pod.
- **Limits**: The maximum the container may use. If exceeded:
  - **CPU**: The container is throttled (it is not killed)
  - **Memory**: The container is killed (OOMKilled)

### Complete Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
```

### Units

**CPU:**
- `1` CPU = 1 core (a physical core on bare metal, a vCPU on a VM; may be a hyperthread)
- `100m` = 0.1 CPU
- `1000m` = 1 CPU
- `1m` is the smallest precision allowed

**Memory:**
- `Ki`, `Mi`, `Gi` (base 1024, the usual choice)
- `K`, `M`, `G` (base 1000)

### Default Behavior
By default, Kubernetes does **NOT** set requests or limits, so a pod can consume all the resources of a node (unless a LimitRange sets defaults). If you set a limit but no request, the request defaults to the limit.

### Common Setup

| | CPU | Memory |
|---|---|---|
| **Requests** | Yes | Yes |
| **Limits** | Often omitted (common recommendation) | Usually set |

- **CPU without limits**: Allows bursting when CPU is available
- **Memory**: Cannot be throttled, so a container that exceeds its limit is OOM-killed. Memory is only reclaimed when the process ends

**EXAM TIP:** `resources` is set at the **container** level, not the pod level. This is a common mistake.

---

## LimitRange

Defines default values and limits for resources at the **namespace level**. Applies to new pods that do not specify resources.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: cpu-resource-constraint
  namespace: dev
spec:
  limits:
  - default:           # Default limit
      cpu: 500m
      memory: 512Mi
    defaultRequest:     # Default request
      cpu: 250m
      memory: 256Mi
    max:                # Maximum allowed
      cpu: "1"
      memory: 1Gi
    min:                # Minimum allowed
      cpu: 100m
      memory: 128Mi
    type: Container
```

**NOTE:** A LimitRange only affects pods created **after** it exists. Existing pods are not affected. Pods that violate `min`/`max` are rejected.

---

## ResourceQuotas

Sets total resource limits for an entire **namespace**. Prevents all the pods together from consuming too many resources.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: my-resource-quota
  namespace: dev
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "10"
    limits.memory: 10Gi
```

**Important difference:**
- **LimitRange** → Limits per individual container/pod
- **ResourceQuota** → Total limits per namespace

**NOTE:** When a quota covers CPU or memory, new pods must specify the corresponding requests/limits (or get them from a LimitRange), otherwise they are rejected.

---

## Service Accounts

### User Accounts vs Service Accounts

| | User Accounts | Service Accounts |
|---|---|---|
| For | Humans (admin, developer) | Applications and tools (Prometheus, Jenkins) |
| Managed by | Outside Kubernetes (certificates, OIDC, etc.); there is no User API object | Kubernetes API (`kubectl`) |
| Scope | Cluster-wide | Namespaced |

### Creating and Using

```bash
# Create a service account
kubectl create serviceaccount dashboard-sa

# List service accounts
kubectl get serviceaccounts               # or kubectl get sa

# Generate a token (time-limited)
kubectl create token dashboard-sa

# Change the SA of a deployment
kubectl set serviceaccount deploy/web-dashboard dashboard-sa
```

### Service Account in a Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  serviceAccountName: dashboard-sa
  containers:
  - name: myapp
    image: myapp
```

### Default Service Account
- Every namespace has a `default` SA created automatically
- Its token is auto-mounted into every pod (at `/var/run/secrets/kubernetes.io/serviceaccount`) as a time-limited, automatically rotated projected token
- To disable:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  automountServiceAccountToken: false
  containers:
  - name: myapp
    image: myapp
```

### Non-Expiring Token (via Secret)
Secrets are no longer created automatically for service accounts; a long-lived token must be requested explicitly:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dashboard-sa-token
  annotations:
    kubernetes.io/service-account.name: dashboard-sa
type: kubernetes.io/service-account-token
```

**EXAM TIP:** Use `kubectl create token <sa-name>` for temporary tokens. To see the mounted credentials: `kubectl describe pod <name>` → Mounts section.

---

## Taints & Tolerations

Control which pods can be scheduled on which nodes.

- **Taint** → Applied to a **Node** ("repels" pods)
- **Toleration** → Applied to a **Pod** ("tolerates" the taint)

### Taint Effects

| Effect | Behavior |
|---|---|
| `NoSchedule` | Pods without a matching toleration are NOT scheduled |
| `PreferNoSchedule` | The scheduler tries to avoid the node, but it is not guaranteed |
| `NoExecute` | Existing pods without a matching toleration are **evicted** |

### Taint Commands
```bash
# Apply a taint
kubectl taint nodes node1 app=myapp:NoSchedule

# Remove a taint (note the trailing -)
kubectl taint nodes node1 app=myapp:NoSchedule-

# View a node's taints
kubectl describe node node1 | grep -i taint
```

### Toleration in a Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: nginx
    image: nginx
  tolerations:
  - key: "app"
    operator: "Equal"
    value: "myapp"
    effect: "NoSchedule"
```

**EXAM TIP:** Quote toleration values in YAML so they are read as strings. The operator can be `Equal` (with a value) or `Exists` (no value).

**IMPORTANT NOTE:** Taints & Tolerations do NOT guarantee that a pod lands on a specific node. They only prevent pods **without** a toleration from being scheduled on that node. To force scheduling onto specific nodes, combine them with Node Affinity.

---

## Node Selectors

A simple way to restrict pods to specific nodes using labels.

### Label the Node
```bash
kubectl label nodes node-1 size=Large
```

### Use nodeSelector in the Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  containers:
  - name: data-processor
    image: data-processor
  nodeSelector:
    size: Large
```

### Limitation
Node Selectors do not support complex logic (OR, NOT). Use Node Affinity for that.

---

## Node Affinity

Constrains pods to specific nodes using more expressive rules.

### Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-processor
spec:
  containers:
  - name: data-processor
    image: data-processor
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: size
            operator: In
            values:
            - Large
            - Medium
```

### Operators

| Operator | Description | Example |
|---|---|---|
| `In` | Value is in the list | size In [Large, Medium] |
| `NotIn` | Value is NOT in the list | size NotIn [Small] |
| `Exists` | Key exists (no value) | size Exists |
| `DoesNotExist` | Key does NOT exist | size DoesNotExist |
| `Gt` / `Lt` | Value greater / less than (integer) | cores Gt 4 |

### Node Affinity Types

| Type | During Scheduling | During Execution |
|---|---|---|
| `requiredDuringSchedulingIgnoredDuringExecution` | **Mandatory** | Ignored |
| `preferredDuringSchedulingIgnoredDuringExecution` | Preferred | Ignored |

- **required**: If no matching node is found → the pod stays **Pending**
- **preferred**: If no matching node is found → the pod is scheduled on any other node (each preference has a `weight` of 1-100)

### Combining Taints + Node Affinity
To ensure that **certain pods go to certain nodes AND those nodes only accept those pods**:
1. **Taint** on the node → keeps other pods away
2. **Toleration** on the pod → lets it tolerate the taint
3. **Node Affinity** on the pod → makes sure it lands on that node

```bash
kubectl describe node node01 | grep -A 10 Labels
```

**EXAM TIP:** In practice, combine Taints + Node Affinity when you need complete isolation. Taints alone do not guarantee that the pod goes to the desired node.

---

## Quick Reference

### Comparison: ConfigMaps vs Secrets

| | ConfigMaps | Secrets |
|---|---|---|
| Purpose | General configuration | Sensitive data |
| Encoding | Plain text | Base64 |
| Kind | `kind: ConfigMap` | `kind: Secret` |
| CLI | `kubectl create configmap` | `kubectl create secret generic` |
| Data field | `data:` | `data:` (base64) or `stringData:` (plain text) |

### Comparison: Scheduling

| Mechanism | Applies To | Purpose |
|---|---|---|
| **Taints/Tolerations** | Nodes/Pods | Repel pods from nodes |
| **Node Selector** | Pods | Simple label matching |
| **Node Affinity** | Pods | Advanced: complex expressions |

### All Imperative Commands

```bash
# === CONFIGMAPS ===
k create configmap name --from-literal=key=value
k create configmap name --from-file=file.properties
k get cm
k describe cm name

# === SECRETS ===
k create secret generic name --from-literal=key=value
k create secret generic name --from-file=file
k get secrets
k get secret name -o yaml
echo -n 'value' | base64
echo -n 'encoded' | base64 --decode

# === SERVICE ACCOUNTS ===
k create serviceaccount name
k create token sa-name
k set serviceaccount deploy/name sa-name
k get sa

# === TAINTS ===
k taint nodes node1 key=value:NoSchedule
k taint nodes node1 key=value:NoSchedule-
k describe node node1 | grep -i taint

# === LABELS ===
k label nodes node1 size=Large
k describe node node1 | grep -A 10 Labels

# === EDITING ===
k edit pod name
k edit deployment name
k get pod name -o yaml > pod.yaml
k replace --force -f pod.yaml
```

### Study Checklist - Configuration
- [ ] I know how Docker CMD/ENTRYPOINT map to Kubernetes command/args
- [ ] I can create and inject ConfigMaps (3 methods)
- [ ] I can create and inject Secrets (3 methods) and use base64
- [ ] I can configure Security Contexts (pod vs container level)
- [ ] I can define Resource Requests & Limits
- [ ] I know the difference between LimitRange and ResourceQuota
- [ ] I can create and assign Service Accounts
- [ ] I can apply/remove Taints and configure Tolerations
- [ ] I can use Node Selectors and Node Affinity
- [ ] I know when to combine Taints + Node Affinity
