# Core Concepts

> CKAD domain: Application Design and Build (20%)

## Table of Contents
1. [Kubernetes Architecture](#kubernetes-architecture)
2. [Docker vs containerd](#docker-vs-containerd)
3. [Pods](#pods)
4. [Pods with YAML](#pods-with-yaml)
5. [ReplicaSets](#replicasets)
6. [Deployments](#deployments)
7. [Namespaces](#namespaces)
8. [Services](#services)
9. [Imperative Commands](#imperative-commands)
10. [Quick Reference](#quick-reference)

---

## Kubernetes Architecture

### Node
- A machine (physical or virtual) where Kubernetes is installed
- Kubernetes launches containers on these nodes

### Cluster
- A set of nodes grouped together
- If one node fails, the application stays reachable on other nodes
- Allows load balancing across multiple nodes

### Kubernetes Components

| Component | Role | Runs On |
|---|---|---|
| **API Server** | Front end of Kubernetes. All communication goes through it | Control plane |
| **etcd** | Key-value store that holds all cluster data | Control plane |
| **Controller Manager** | Runs the controllers that watch the cluster and react to changes | Control plane |
| **Scheduler** | Assigns pods to the available nodes | Control plane |
| **Kubelet** | Agent that runs on every node and makes sure containers are running | Worker |
| **Container Runtime** | Software that runs the containers (containerd, CRI-O) | Worker |
| **Kube Proxy** | Maintains network rules on nodes so Services can route traffic to pods | Worker |

### Control Plane Node vs Worker Node
- **Control plane node** (formerly "master"): Responsible for orchestration. Runs the API Server, etcd, Controller Manager and Scheduler
- **Worker node**: Where applications run. Runs the Kubelet, a container runtime and Kube Proxy

**EXAM TIP:** You do not need to set up clusters for the CKAD exam, but understanding the architecture helps with debugging.

### kubectl (Kube Control)
The CLI tool for managing a Kubernetes cluster.

```bash
kubectl cluster-info                  # Cluster info
kubectl get nodes                     # List nodes
kubectl get nodes -o wide             # Detailed node info
```

---

## Docker vs containerd

Since Kubernetes v1.24, Docker Engine is no longer supported as a container runtime (dockershim was removed). **containerd** (or CRI-O) is used instead. Images built with Docker still run unchanged.

### CLI Tools

| Tool | Purpose | Pod-aware | Use |
|---|---|---|---|
| **ctr** | Ships with containerd | No | Debugging only |
| **nerdctl** | Docker-like CLI for containerd | No | General use |
| **crictl** | CLI for CRI-compatible runtimes | **Yes** | Debug/inspect |

### ctr (debugging only)
```bash
ctr images pull docker.io/library/redis:alpine
ctr run docker.io/library/redis:alpine redis
```
**NOTE:** Not meant for production use.

### nerdctl (drop-in replacement for the docker CLI)
```bash
nerdctl run --name redis redis:alpine
nerdctl run --name webserver -p 80:80 -d nginx
```

### crictl (debugging container runtimes)
```bash
crictl pull busybox
crictl images                    # List images
crictl ps -a                     # List all containers
crictl pods                      # List pods (!)
crictl exec -i -t <id> ls        # Run a command in a container
crictl logs <container-id>       # View logs
crictl inspect <container-id>    # Inspect a container
```

**EXAM TIP:** In the exam you will mostly use `kubectl`. `crictl` is useful for node-level debugging but is rarely needed for the CKAD.

---

## Pods

### What Is a Pod?
- **The smallest deployable unit in Kubernetes**
- Hierarchy: Cluster → Nodes → Pods → Containers
- A Pod wraps one or more containers
- Common practice: **one container per Pod** (single-container pods)

### Scaling Means Adding Pods, Not Containers
To scale a service, create **more Pods** rather than adding containers to an existing Pod.

### Multi-Container Pods
- An app container plus a helper container in the same Pod
- They share:
  - **Network** (they communicate via `localhost`)
  - **Storage** (the same volumes)
  - **Lifecycle** (created and destroyed together)

### Basic Commands
```bash
# Create a pod (imperative)
kubectl run nginx --image=nginx

# List pods
kubectl get pods
kubectl get pods -o wide          # More detail (IP, Node)
kubectl get pods -w               # Watch mode (real time)
kubectl get pods --show-labels    # Show labels
```

**EXAM TIP:** `kubectl run` creates only Pods (not Deployments). It is the fastest way to create a pod in the exam.

---

## Pods with YAML

### Basic Structure (4 required top-level fields)
Every Kubernetes object in YAML has these 4 top-level fields:

```yaml
apiVersion:    # API version
kind:          # Object type
metadata:      # Data about the object (name, labels)
spec:          # Object specification
```

### apiVersion Table

| Kind | apiVersion |
|---|---|
| Pod | `v1` |
| Service | `v1` |
| ConfigMap | `v1` |
| Secret | `v1` |
| Namespace | `v1` |
| ReplicaSet | `apps/v1` |
| Deployment | `apps/v1` |
| Job | `batch/v1` |
| CronJob | `batch/v1` |
| NetworkPolicy | `networking.k8s.io/v1` |
| Ingress | `networking.k8s.io/v1` |
| PersistentVolume | `v1` |
| PersistentVolumeClaim | `v1` |

If unsure, check with `kubectl api-resources` or `kubectl explain <kind>`.

### Complete Pod Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
    type: front-end
spec:
  containers:
  - name: nginx-container
    image: nginx
    ports:
    - containerPort: 80
```

**EXAM TIP:** Labels are essential. Services, ReplicaSets and Deployments use them to identify pods.

### CRUD Commands for Pods
```bash
# Create
kubectl create -f pod-definition.yml
kubectl apply -f pod-definition.yml

# Read
kubectl get pods
kubectl describe pod myapp-pod
kubectl get pod myapp-pod -o yaml    # Full YAML output

# Edit
kubectl edit pod myapp-pod

# Delete
kubectl delete pod myapp-pod
kubectl delete pod myapp-pod --force  # Force (no grace period)
```

### Editing Pods: Editable Fields
On a running Pod, **only these fields can be changed**:
- `spec.containers[*].image`
- `spec.initContainers[*].image`
- `spec.activeDeadlineSeconds`
- `spec.tolerations` (additions only)
- `spec.terminationGracePeriodSeconds`

Container CPU/memory `resources` can also be resized in place (stable since v1.35) through the `resize` subresource, but this is rarely needed for the exam.

**Workaround for editing other fields:**
```bash
# Option 1: edit (kubectl saves a temporary copy automatically)
kubectl edit pod myapp-pod
# If it fails → delete and recreate using the temp file it reports
kubectl delete pod myapp-pod
kubectl create -f /tmp/kubectl-edit-xxxxx.yaml

# Option 2: export, edit, replace
kubectl get pod myapp-pod -o yaml > pod.yaml
# edit pod.yaml
kubectl replace --force -f pod.yaml
```

**EXAM TIP:** `kubectl replace --force -f pod.yaml` deletes and recreates the pod in a single command. Very handy in the exam to save time.

---

## ReplicaSets

### Why Replicas?
- **High availability**: if one pod dies, others keep serving
- **Load balancing**: spreads traffic across multiple pods
- **Scaling**: scale horizontally as load grows

### ReplicationController (LEGACY) vs ReplicaSet (CURRENT)

| | ReplicationController | ReplicaSet |
|---|---|---|
| apiVersion | `v1` | `apps/v1` |
| Selector | Optional (defaults to the template labels) | **Required** (`matchLabels`) |
| Status | Legacy, superseded by ReplicaSet | **Current** |

### ReplicaSet: Complete Example
```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: myapp-replicaset
  labels:
    app: myapp
    type: front-end
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        type: front-end
    spec:
      containers:
      - name: nginx-container
        image: nginx
```

**EXAM TIP:** `selector.matchLabels` MUST match the labels in `template.metadata.labels`. If they do not match, the API server rejects the ReplicaSet.

### ReplicaSet Commands
```bash
kubectl create -f replicaset-definition.yml
kubectl get replicaset                           # or kubectl get rs
kubectl describe replicaset myapp-replicaset
kubectl delete replicaset myapp-replicaset

# Scale
kubectl scale replicaset myapp-replicaset --replicas=6
kubectl scale -f replicaset-definition.yml --replicas=6

# Edit (the new spec applies immediately, but existing pods are NOT
# recreated: delete them so the ReplicaSet creates new ones from the new template)
kubectl edit replicaset myapp-replicaset
```

---

## Deployments

### What Is a Deployment?
- A higher-level Kubernetes object that manages ReplicaSets
- Provides rolling updates, rollbacks and pause/resume
- Hierarchy: **Deployment → ReplicaSet → Pods**

### Complete Example
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-deployment
  labels:
    app: myapp
    type: front-end
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        type: front-end
    spec:
      containers:
      - name: nginx-container
        image: nginx:1.21
```

**EXAM TIP:** A Deployment has the same structure as a ReplicaSet; the main difference is `kind: Deployment`. It is the most commonly used workload object.

### Deployment Commands
```bash
# Create
kubectl create deployment myapp --image=nginx --replicas=3
kubectl create -f deployment-definition.yml

# Read
kubectl get deployments                # or kubectl get deploy
kubectl describe deployment myapp
kubectl get all                        # Common workload objects (deploy + rs + pods + svc)

# Edit (pods are recreated by a rolling update)
kubectl edit deployment myapp

# Scale
kubectl scale deployment myapp --replicas=5
```

### create vs apply vs run

| Command | What it does | When to use |
|---|---|---|
| `kubectl run` | Creates only **Pods** | Quick one-off pods |
| `kubectl create` | Creates resources (imperative) | When the resource does NOT exist yet |
| `kubectl apply` | Creates OR updates (declarative) | When working with YAML files |

**EXAM TIP:** In the exam, use `kubectl create` with `--dry-run=client -o yaml` to generate YAML quickly, then edit as needed.

---

## Namespaces

### Default Namespaces
| Namespace | Purpose |
|---|---|
| `default` | Where resources are created if no namespace is specified |
| `kube-system` | Kubernetes system components (leave alone) |
| `kube-public` | Resources readable by all clients, including unauthenticated ones |
| `kube-node-lease` | Node heartbeats (Lease objects) |

### Namespace = Isolation
- Each namespace can have its own policies, quotas and permissions
- Ideal for separating environments (dev, staging, prod) within the same cluster

### DNS Across Namespaces
To reach a Service in another namespace:
```
<service-name>.<namespace>.svc.cluster.local
```
Example:
```
db-service.dev.svc.cluster.local
```
- `db-service` → Service name
- `dev` → Namespace
- `svc` → Type (Service)
- `cluster.local` → Cluster domain (the default)

**EXAM TIP:** Within the same namespace, the Service name alone is enough: `db-service`. The FQDN is only needed for communication **across** namespaces (`<service>.<namespace>` also works).

### Namespace Commands
```bash
# Create a namespace
kubectl create namespace dev

# List pods in a specific namespace
kubectl get pods --namespace=dev
kubectl get pods -n dev              # Shorthand

# Create a resource in a namespace
kubectl create -f pod.yml --namespace=dev
kubectl create -f pod.yml -n dev

# List pods in ALL namespaces
kubectl get pods --all-namespaces
kubectl get pods -A                  # Shorthand

# Change the default namespace of the current context
kubectl config set-context --current --namespace=dev
```

**EXAM TIP:** ALWAYS check which namespace the question uses. Many mistakes come from creating resources in the wrong namespace. Use `-n <namespace>` on every command.

### Namespace in YAML
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
```

Or set the namespace directly on the resource:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  namespace: dev     # <-- Here
spec:
  containers:
  - name: myapp
    image: myapp
```

### ResourceQuota (per Namespace)
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: dev
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 5Gi
    limits.cpu: "10"
    limits.memory: 10Gi
```

---

## Services

Services provide connectivity between pods and from the outside world.

### Service Types

| Type | Purpose | Reachable From |
|---|---|---|
| **ClusterIP** | Internal communication between pods | Inside the cluster |
| **NodePort** | Exposes a port on every Node | Outside the cluster (Node IP) |
| **LoadBalancer** | Exposes via the cloud provider's load balancer | Internet |

### NodePort
Exposes the service on a static port on every Node in the cluster.

```
[Outside] → NodePort (30008) → Service Port (80) → Pod TargetPort (80)
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: NodePort
  ports:
  - targetPort: 80      # Container/pod port
    port: 80             # Service port (REQUIRED)
    nodePort: 30008      # Port exposed on the Node (30000-32767)
  selector:
    app: myapp
    type: front-end
```

**Rules:**
- `port` is the **only required field**
- If `targetPort` is omitted → it defaults to the value of `port`
- If `nodePort` is omitted → Kubernetes allocates a free port automatically (default range 30000-32767)
- `ports` is an array → each entry starts with `-`

### ClusterIP (Default)
Creates an internal virtual IP for pod-to-pod communication.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: back-end
spec:
  type: ClusterIP      # Default (can be omitted)
  ports:
  - targetPort: 80
    port: 80
  selector:
    app: myapp
    type: back-end
```

### LoadBalancer
Integrates with the cloud provider's load balancer (AWS, GCP, Azure).

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: LoadBalancer
  ports:
  - targetPort: 80
    port: 80
    nodePort: 30008
  selector:
    app: myapp
```

**NOTE:** A LoadBalancer Service also gets a NodePort and ClusterIP. Without a cloud provider (e.g. minikube), the external IP stays `<pending>`; the service is still reachable through its NodePort (or via `minikube tunnel`).

### Service → Pod Linking
The Service uses its `selector` to find matching pods. The selector labels must match the pod labels.

### Service Commands
```bash
# Create a service for a pod (imperative)
kubectl expose pod redis --port=6379 --type=ClusterIP --name=redis-service

# Create a service for a deployment
kubectl expose deployment myapp --port=80 --type=NodePort --name=myapp-service

# NodePort with a specific port (via dry-run + edit)
kubectl expose pod nginx --port=80 --type=NodePort --name=nginx-service --dry-run=client -o yaml > svc.yaml
# Edit svc.yaml to add nodePort, then:
kubectl apply -f svc.yaml

# List services
kubectl get services                 # or kubectl get svc
kubectl describe service myapp-service
```

**EXAM TIP:** `kubectl expose` is the fastest way to create a Service in the exam. However, it cannot set `nodePort` directly. Use `--dry-run=client -o yaml` and edit the file.

---

## Imperative Commands

### Essential Flags
```bash
--dry-run=client     # Does not create the resource; only builds/validates it locally
-o yaml              # YAML output
-o json              # JSON output
-o wide              # Extra information (IP, Node, etc.)
-o name              # Resource name only
```

### Generate YAML Without Creating (the exam pattern)
```bash
kubectl run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
kubectl create deployment myapp --image=nginx --dry-run=client -o yaml > deploy.yaml
```

### kubectl explain (inline documentation)
```bash
kubectl explain pod                    # Top-level fields of a Pod
kubectl explain pod.spec               # Fields inside spec
kubectl explain pod.spec.containers    # Container fields
kubectl api-resources                  # List all available resources
```

**EXAM TIP:** `kubectl explain` is your best friend in the exam when you cannot remember a YAML structure. It is faster than searching the documentation.

---

## Quick Reference

### Resource Short Names

| Resource | Short name |
|---|---|
| pods | `po` |
| services | `svc` |
| deployments | `deploy` |
| replicasets | `rs` |
| namespaces | `ns` |
| nodes | `no` |
| configmaps | `cm` |
| secrets | (no short name) |
| persistentvolumes | `pv` |
| persistentvolumeclaims | `pvc` |
| serviceaccounts | `sa` |
| networkpolicies | `netpol` |
| ingresses | `ing` |

### Recommended Aliases for the Exam
```bash
alias k=kubectl
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgd='kubectl get deploy'
alias kga='kubectl get all'
alias kd='kubectl describe'
alias kdp='kubectl describe pod'
```

**EXAM TIP:** The `k=kubectl` alias (with bash completion) is pre-configured in the exam environment. Use `k` instead of `kubectl` to save time.

### Most-Used Imperative Commands

```bash
# === PODS ===
k run nginx --image=nginx
k run nginx --image=nginx --port=80
k run nginx --image=nginx --dry-run=client -o yaml > pod.yaml
k run nginx --image=nginx -l app=web        # With a label
k run nginx --image=nginx --env="APP=blue"  # With an env var
k run nginx --image=nginx --command -- sleep 3600  # With a command

# === DEPLOYMENTS ===
k create deployment myapp --image=nginx --replicas=3
k create deployment myapp --image=nginx --dry-run=client -o yaml > deploy.yaml
k scale deployment myapp --replicas=5
k set image deployment/myapp nginx=nginx:1.25

# === SERVICES ===
k expose pod redis --port=6379 --name=redis-svc
k expose pod nginx --port=80 --type=NodePort --name=nginx-svc
k expose deployment myapp --port=80 --type=ClusterIP --name=myapp-svc
k create service clusterip redis --tcp=6379:6379

# === NAMESPACES ===
k create namespace dev
k get pods -n dev
k get pods -A                                # All namespaces
k config set-context --current --namespace=dev

# === GENERAL ===
k get all                                    # Common workload objects in the current namespace
k get all -A                                 # Same, across all namespaces
k delete pod nginx --force                   # Delete without grace period
k replace --force -f pod.yaml                # Delete and recreate
k explain pod.spec.containers                # Inline documentation
k api-resources                              # All resource types
```

### Study Checklist - Core Concepts
- [ ] I can create Pods with `kubectl run` and with YAML
- [ ] I know the difference between a ReplicationController and a ReplicaSet
- [ ] I can create and scale Deployments
- [ ] I can work with Namespaces and switch the context namespace
- [ ] I can create the 3 Service types (ClusterIP, NodePort, LoadBalancer)
- [ ] I can use `--dry-run=client -o yaml` to generate templates
- [ ] I can use `kubectl explain` to look up documentation
- [ ] I know the short names of the most common resources
