# Observability

> CKAD domain: Application Observability and Maintenance (15%)

## Table of Contents
1. [Pod Lifecycle](#pod-lifecycle)
2. [Pod Conditions](#pod-conditions)
3. [Restart Policies](#restart-policies)
4. [Readiness Probes](#readiness-probes)
5. [Liveness Probes](#liveness-probes)
6. [Startup Probes](#startup-probes)
7. [Probe Comparison](#probe-comparison)
8. [Logging](#logging)
9. [Monitoring](#monitoring)
10. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
11. [Common Exam Scenarios](#common-exam-scenarios)
12. [Quick Reference](#quick-reference)

---

## Pod Lifecycle

### Pod Phases

| Phase | Description |
|---|---|
| `Pending` | Pod accepted by the cluster, but its containers are not running yet (pulling images, waiting to be scheduled) |
| `Running` | Pod bound to a node, at least 1 container is running (or starting/restarting) |
| `Succeeded` | All containers terminated successfully (exit code 0) and will not be restarted |
| `Failed` | All containers terminated, at least one with an error |
| `Unknown` | The pod state cannot be determined (usually a communication failure with the node) |

**NOTE:** Values such as `CrashLoopBackOff`, `ImagePullBackOff`, `Terminating` or `Init:0/2` in `kubectl get pods` are not phases. They are status reasons derived from container states.

### Container States

| State | Description |
|---|---|
| `Waiting` | Waiting to start (image pull, etc.) |
| `Running` | Executing without issues |
| `Terminated` | Finished executing (successfully or with an error) |

---

## Pod Conditions

Conditions that describe the detailed state of the pod. Visible with `kubectl describe pod`.

| Condition | Description |
|---|---|
| `PodScheduled` | The pod has been assigned to a node |
| `Initialized` | All init containers completed successfully |
| `ContainersReady` | All containers are ready |
| `Ready` | The pod is ready to receive traffic (it is included in Service endpoints) |

**EXAM TIP:** The `READY` column in `kubectl get pods` reflects container readiness. If it shows `0/1`, the container is not ready (possibly a failing readiness probe).

---

## Restart Policies

Set at the **pod level** (`spec.restartPolicy`). Applies to all containers in the pod.

| Policy | Behavior | Typical Use |
|---|---|---|
| `Always` (default) | Always restarts a container when it exits | Long-running services (web servers) |
| `OnFailure` | Restarts only if the exit code is non-zero | Jobs, batch processing |
| `Never` | Never restarts | Debugging, one-shot tasks |

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  restartPolicy: OnFailure
  containers:
  - name: myapp
    image: myapp
```

**EXAM TIP:** Jobs require `Never` or `OnFailure` (`Always` is rejected). A bare Pod with `Always` restarts its container forever, even after it exits successfully.

---

## Readiness Probes

Check whether the container is **ready to receive traffic**. While the readiness probe fails, the pod is removed from the Service endpoints (it receives no traffic).

### Why Use Them?
Without a readiness probe, Kubernetes assumes the pod is ready as soon as the container starts. If the application takes time to initialize, users may see errors or downtime.

### Probe Mechanisms

**1. HTTP GET**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    readinessProbe:
      httpGet:
        path: /api/ready
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
      failureThreshold: 3
```

**2. TCP Socket**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mydb
spec:
  containers:
  - name: mydb
    image: mysql
    readinessProbe:
      tcpSocket:
        port: 3306
      initialDelaySeconds: 15
      periodSeconds: 10
```

**3. Exec Command**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    readinessProbe:
      exec:
        command:
        - cat
        - /app/is_ready
      initialDelaySeconds: 5
      periodSeconds: 5
```

A fourth mechanism, `grpc` (gRPC health checking protocol, stable since v1.27), also exists.

---

## Liveness Probes

Check whether the container is **healthy/alive**. If the liveness probe fails, Kubernetes **restarts the container**.

### Why Use Them?
Often the container and pod are "running" but the application inside is stuck (deadlock, hung without exiting, etc.). The liveness probe detects this and restarts the container.

### Same Mechanisms
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  containers:
  - name: myapp
    image: myapp
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 5
```

```yaml
    livenessProbe:
      tcpSocket:
        port: 8080
```

```yaml
    livenessProbe:
      exec:
        command:
        - cat
        - /tmp/healthy
```

**EXAM TIP:** If the pod is in `CrashLoopBackOff`, check:
1. The logs: `kubectl logs pod-name --previous`
2. The liveness probe may be misconfigured (wrong port, wrong path, insufficient delay)

---

## Startup Probes

Check whether the application has **started successfully**. Until the startup probe succeeds:
- The liveness probe is **NOT run** (it will not kill the container during a slow startup)
- The readiness probe is **NOT run**

### Why Use Them?
For applications that take a long time to start (legacy or heavy apps). Without a startup probe, the liveness probe may kill the container before the app has had time to initialize.

### Maximum Startup Time Calculation
```
failureThreshold × periodSeconds = maximum startup time
```
(Add `initialDelaySeconds` if you set one.)

### Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: legacy-app
spec:
  containers:
  - name: legacy-app
    image: legacy-app
    startupProbe:
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30     # 30 attempts
      periodSeconds: 10        # Every 10 seconds
      # Maximum time: 30 × 10 = 300 seconds (5 minutes)
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
```

**EXAM TIP:** If the question mentions "an application that takes a long time to initialize" → think startup probe.

---

## Probe Comparison

| | Readiness | Liveness | Startup |
|---|---|---|---|
| **Question** | Ready for traffic? | Alive/healthy? | Has it started yet? |
| **If it fails** | Removed from endpoints (no traffic) | Container is restarted | Container is restarted |
| **When it runs** | After the startup probe passes | After the startup probe passes | From the beginning |
| **Runs continuously** | Yes | Yes | No (stops once it passes) |
| **Use case** | Apps with warm-up | Detecting deadlocks | Slow-starting apps |

### All Configuration Options

| Option | Default | Description |
|---|---|---|
| `initialDelaySeconds` | 0 | Seconds to wait before the first probe |
| `periodSeconds` | 10 | Interval between probes |
| `timeoutSeconds` | 1 | Timeout for each probe |
| `successThreshold` | 1 | Consecutive successes needed to be considered healthy again |
| `failureThreshold` | 3 | Consecutive failures before acting |

**EXAM TIP:** `successThreshold` must be 1 for liveness and startup probes. For readiness it can be greater than 1.

---

## Logging

### Docker
```bash
docker run busybox sh -c 'while true; do echo "$(date) event processed"; sleep 2; done'      # Logs on screen (foreground)
docker run -d busybox sh -c 'while true; do echo "$(date) event processed"; sleep 2; done'   # Background (no output)
docker logs container-id                     # View logs
docker logs -f container-id                  # Follow/stream
```

### Kubernetes
```bash
# Logs of a pod (single container)
kubectl logs pod-name
kubectl logs pod-name -f                     # Follow/stream in real time
kubectl logs pod-name --tail=50              # Last 50 lines
kubectl logs pod-name --since=1h             # Last hour
kubectl logs pod-name --since=30m            # Last 30 minutes
kubectl logs pod-name --timestamps           # With timestamps

# Logs of a multi-container pod (use -c to pick the container;
# without it kubectl defaults to the first one)
kubectl logs pod-name -c container-name
kubectl logs pod-name -c container-name -f
kubectl logs pod-name --all-containers=true

# Logs of the previous container instance (after a restart)
kubectl logs pod-name --previous
kubectl logs pod-name -c container-name --previous
kubectl logs pod-name -p                     # Shorthand
```

**EXAM TIP:** If the pod is in `CrashLoopBackOff`, use `--previous` or `-p` to see the logs of the instance that ran before the restart.

---

## Monitoring

### Monitoring Solutions
- **Metrics Server** (basic, in-memory)
- Prometheus (open source)
- Elastic Stack (ELK)
- Datadog (commercial)
- Dynatrace (commercial)

### Metrics Server
- Collects CPU and memory usage from all nodes and pods
- **In-memory only**: no history, no persistent data
- One Metrics Server per cluster

### Setup
```bash
# Minikube
minikube addons enable metrics-server

# Other clusters
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Monitoring Commands
```bash
kubectl top node                            # Usage per node
kubectl top node --sort-by=cpu              # Sort by CPU
kubectl top node --sort-by=memory           # Sort by memory

kubectl top pod                             # Usage per pod
kubectl top pod --sort-by=cpu               # Sort by CPU
kubectl top pod --sort-by=memory            # Sort by memory
kubectl top pod -n namespace                # Specific namespace
kubectl top pod --containers                # Per container
```

**EXAM TIP:** `kubectl top` requires Metrics Server. If the command fails, metrics-server may not be deployed.

---

## Debugging and Troubleshooting

### Essential Commands
```bash
# Detailed pod information (events, conditions, state)
kubectl describe pod pod-name

# State of all pods
kubectl get pods -o wide                    # With IP and Node

# Namespace events (chronological order)
kubectl get events
kubectl get events --sort-by=.metadata.creationTimestamp

# Run a command inside the container
kubectl exec pod-name -- command
kubectl exec -it pod-name -- /bin/sh        # Interactive shell
kubectl exec -it pod-name -c container -- /bin/sh  # Specific container

# Attach an ephemeral debug container (useful when the image has no shell)
kubectl debug -it pod-name --image=busybox:1.36 --target=container
```

### Common Exit Codes

| Exit Code | Meaning |
|---|---|
| `0` | Success (exited normally) |
| `1` | Generic application error |
| `126` | Command cannot be executed |
| `127` | Command not found |
| `137` | Container killed (OOMKilled or SIGKILL), 128 + 9 |
| `139` | Segmentation fault (SIGSEGV), 128 + 11 |
| `143` | Container terminated by SIGTERM (graceful shutdown), 128 + 15 |

**EXAM TIP:** Exit code `137` usually means **OOMKilled**: the container exceeded its memory limit. Check `kubectl describe pod` → "Last State" section → "Reason: OOMKilled".

### Debugging Flow

```
Pod will not start?
├── Pending → kubectl describe pod (scheduling events)
│   ├── Insufficient resources → Adjust requests/limits
│   ├── No nodes available → Check taints/tolerations
│   └── Unschedulable → Check whether the node is cordoned
├── ImagePullBackOff → Image does not exist or credentials are wrong
├── CrashLoopBackOff → kubectl logs pod-name --previous
│   ├── Exit 1 → Application error
│   ├── Exit 137 → OOMKilled (not enough memory)
│   └── Failing liveness probe → Adjust the probe config
└── Running but not Ready → Readiness probe failing
```

---

## Common Exam Scenarios

### 1. Add a readiness probe to an existing pod
```bash
kubectl get pod webapp -o yaml > pod.yaml
# Edit pod.yaml → add readinessProbe to the container
kubectl replace --force -f pod.yaml
```

### 2. Pod in CrashLoopBackOff
```bash
kubectl logs pod-name --previous     # See logs from the last run
kubectl describe pod pod-name        # See events and exit code
```

### 3. App that takes 60s to start
```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 12
  periodSeconds: 5
  # 12 × 5 = 60 seconds maximum startup time
```

### 4. Identify the pod using the most resources
```bash
kubectl top pod --sort-by=cpu
kubectl top pod --sort-by=memory
```

### 5. View logs of all pods with a label
```bash
kubectl logs -l app=myapp --all-containers=true
# Note: with a selector, kubectl logs defaults to --tail=10 per pod; add --tail=-1 for all lines
```

---

## Quick Reference

### All Observability Commands
```bash
# === LOGS ===
k logs pod-name                         # Basic logs
k logs pod-name -f                      # Follow/stream
k logs pod-name -c container-name       # Specific container
k logs pod-name --previous              # After a restart
k logs pod-name --tail=50               # Last 50 lines
k logs pod-name --since=1h              # Last hour
k logs -l app=myapp                     # By label

# === MONITORING ===
k top node                              # Resources per node
k top pod                               # Resources per pod
k top pod --sort-by=cpu                 # Sort by CPU
k top pod --sort-by=memory              # Sort by memory
k top pod --containers                  # Per container

# === DEBUG ===
k describe pod pod-name                 # Details + events
k get events --sort-by='.metadata.creationTimestamp'
k exec -it pod-name -- /bin/sh          # Shell
k exec pod-name -- cat /var/log/app.log # Read a file
k get pods -o wide                      # See IPs and Nodes
```

### YAML Template - Pod with All Probes
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-probes
spec:
  containers:
  - name: myapp
    image: myapp
    ports:
    - containerPort: 8080
    startupProbe:
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30
      periodSeconds: 10
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 0
      periodSeconds: 10
      timeoutSeconds: 1
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 0
      periodSeconds: 5
      timeoutSeconds: 1
      successThreshold: 1
      failureThreshold: 3
```

### Probe Default Values

| Option | Default |
|---|---|
| `initialDelaySeconds` | 0 |
| `periodSeconds` | 10 |
| `timeoutSeconds` | 1 |
| `successThreshold` | 1 |
| `failureThreshold` | 3 |

### Study Checklist - Observability
- [ ] I know the pod lifecycle phases (Pending, Running, Succeeded, Failed)
- [ ] I know the difference between readiness, liveness and startup probes
- [ ] I can configure the probe mechanisms (httpGet, tcpSocket, exec)
- [ ] I know all probe parameters and their defaults
- [ ] I can use kubectl logs with all the useful flags
- [ ] I can use kubectl top for monitoring
- [ ] I can debug with kubectl describe and kubectl get events
- [ ] I know the most common exit codes (0, 1, 137, 143)
