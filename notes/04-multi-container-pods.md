# Multi-Container Pods

> CKAD domain: Application Design and Build (20%)

## Table of Contents
1. [Concept](#concept)
2. [Design Patterns](#design-patterns)
3. [Init Containers](#init-containers)
4. [Sidecar Containers](#sidecar-containers)
5. [Ambassador Pattern](#ambassador-pattern)
6. [Adapter Pattern](#adapter-pattern)
7. [Shared Volumes](#shared-volumes)
8. [Common Exam Scenarios](#common-exam-scenarios)
9. [Quick Reference](#quick-reference)

---

## Concept

The idea is to split a large application into smaller services that can be scaled independently.

When two services depend on each other and must share the same lifecycle, place them in the **same Pod** as **multiple containers**.

### Characteristics
- **Created and destroyed together** (same lifecycle)
- **Share the network** → they communicate via `localhost`
- **Share storage** → the same volumes can be mounted in each container
- **Share the same IP** → the pod has a single IP

### Basic Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: simple-webapp
  labels:
    name: simple-webapp
spec:
  containers:
  - name: web-app
    image: web-app
    ports:
    - containerPort: 8080
  - name: log-agent
    image: log-agent
```

**EXAM TIP:** In the exam, adding a second container is just adding another element to the `containers:` array. Do not forget the `-` before `name:`.

---

## Design Patterns

The main multi-container pod patterns:

| Pattern | Description | Example |
|---|---|---|
| **Co-located** | Two containers that depend on each other | Web server + app server |
| **Sidecar** | Helper container that extends the main one | Log shipper, monitoring agent |
| **Ambassador** | Proxy that abstracts external communication | Proxy to different databases |
| **Adapter** | Transforms the main container's output | Format logs to a common standard |

---

## Init Containers

Containers that run **before** the main containers and must complete successfully before the pod continues.

### Characteristics
- They run **sequentially** (one at a time, in order)
- Each one must complete successfully before the next one starts
- If an init container fails, the kubelet retries it according to the pod's `restartPolicy` (with `Never`, the pod is marked as failed)
- They do not keep running: they execute and exit

### Use Cases
- Wait for a service/database to become available
- Download configuration
- Register the pod with an external service
- Clone a Git repository

### Complete Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
  labels:
    app: myapp
spec:
  containers:
  - name: myapp-container
    image: busybox:1.28
    command: ['sh', '-c', 'echo The app is running! && sleep 3600']
  initContainers:
  - name: init-myservice
    image: busybox:1.28
    command: ['sh', '-c', 'until nslookup myservice; do echo waiting for myservice; sleep 2; done']
  - name: init-mydb
    image: busybox:1.28
    command: ['sh', '-c', 'until nslookup mydb; do echo waiting for mydb; sleep 2; done']
```

**EXAM TIP:** If the pod is stuck in `Init:0/2` or `Init:CrashLoopBackOff`, check the init containers with `kubectl logs pod-name -c init-container-name`.

---

## Sidecar Containers

### Classic Sidecar (co-located containers)
Simply two containers in the same pod, both under `containers:`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
spec:
  containers:
  - name: app
    image: myapp
    volumeMounts:
    - name: log-volume
      mountPath: /var/log
  - name: sidecar-logger
    image: fluentd
    volumeMounts:
    - name: log-volume
      mountPath: /var/log
  volumes:
  - name: log-volume
    emptyDir: {}
```

### Native Sidecar (enabled by default since v1.29, stable in v1.33)
Defined under `initContainers` with `restartPolicy: Always`. This guarantees that:
- The sidecar starts **before** the main containers
- The sidecar keeps running for the whole lifetime of the pod
- The sidecar is only terminated **after** the main containers

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-native-sidecar
spec:
  containers:
  - name: main-app
    image: myapp
  initContainers:
  - name: log-shipper
    image: fluentd
    restartPolicy: Always    # <-- This makes it a native sidecar
```

**Key difference between a co-located sidecar and a native sidecar:** The native sidecar gives control over **startup order**: the sidecar starts first.

### Example: Logging with the ELK Stack
An application uses a sidecar (Filebeat) to collect logs and ship them to Elasticsearch/Logstash (Kibana is then used to view them):
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-elk
spec:
  containers:
  - name: app
    image: myapp
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app
  initContainers:
  - name: filebeat-sidecar
    image: docker.elastic.co/beats/filebeat:7.17.0
    restartPolicy: Always
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app
      readOnly: true
    - name: filebeat-config
      mountPath: /usr/share/filebeat/filebeat.yml
      subPath: filebeat.yml
  volumes:
  - name: shared-logs
    emptyDir: {}
  - name: filebeat-config
    configMap:
      name: filebeat-config
```

---

## Ambassador Pattern

The ambassador container acts as a **proxy** that hides the complexity of talking to external services.

### Use Case
The application wants to talk to a database, but the address changes depending on the environment (dev, staging, prod). The ambassador routes traffic transparently.

```
App Container → localhost:5432 → Ambassador → DB (dev/staging/prod)
```

### Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-ambassador
spec:
  containers:
  - name: main-app
    image: myapp
    env:
    - name: DB_HOST
      value: "localhost"       # Always talks to localhost
    - name: DB_PORT
      value: "5432"
  - name: ambassador
    image: haproxy
    ports:
    - containerPort: 5432
    volumeMounts:
    - name: ambassador-config
      mountPath: /usr/local/etc/haproxy
  volumes:
  - name: ambassador-config
    configMap:
      name: haproxy-config
```

**EXAM TIP:** The Ambassador pattern is less common in the exam than the Sidecar, but you should be able to recognize it.

---

## Adapter Pattern

The adapter container **transforms** the main container's output into a standardized format.

### Use Case
Several microservices produce logs in different formats. The adapter normalizes the logs before they are sent to the central monitoring system.

```
App Container (format A) → Adapter → Standard format → Monitoring System
```

### Example
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-adapter
spec:
  containers:
  - name: main-app
    image: busybox
    command: ['sh', '-c', 'while true; do echo "$(date) request handled" >> /var/log/app/output.log; sleep 2; done']
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app
  - name: log-adapter
    image: busybox
    command: ['sh', '-c']
    args:
    - |
      tail -F /var/log/app/output.log | while read -r line; do
        echo "{\"message\": \"$line\"}" >> /var/log/app/formatted.log
      done
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app
  volumes:
  - name: shared-logs
    emptyDir: {}
```

---

## Shared Volumes

The most common way to share data between containers in the same pod is an `emptyDir` volume.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-volume-pod
spec:
  containers:
  - name: writer
    image: busybox
    command: ['sh', '-c', 'echo "Hello" > /data/message.txt && sleep 3600']
    volumeMounts:
    - name: shared-data
      mountPath: /data
  - name: reader
    image: busybox
    command: ['sh', '-c', 'cat /data/message.txt && sleep 3600']
    volumeMounts:
    - name: shared-data
      mountPath: /data
  volumes:
  - name: shared-data
    emptyDir: {}
```

**NOTE:** An `emptyDir` is created when the pod is assigned to a node and is deleted when the pod is removed.

---

## Common Exam Scenarios

### 1. Add a sidecar to an existing pod
Containers cannot be added to a running pod, so the pod has to be recreated.
```bash
kubectl get pod app -o yaml > pod.yaml
# Edit pod.yaml → add a second container under containers:
kubectl replace --force -f pod.yaml
```

### 2. View logs of a specific container in a multi-container pod
```bash
kubectl logs pod-name -c container-name
kubectl logs pod-name -c container-name -f    # Follow/stream
kubectl logs pod-name -c container-name -p    # Previous (after a restart)
```

### 3. Run a command in a specific container
```bash
kubectl exec -it pod-name -c container-name -- /bin/sh
kubectl exec pod-name -c container-name -- cat /var/log/app.log
```

### 4. Debugging init containers
```bash
# Check the state of the init containers
kubectl describe pod pod-name    # See the "Init Containers" section

# View the logs of an init container
kubectl logs pod-name -c init-container-name
```

**EXAM TIP:** If you omit `-c container-name` on a multi-container pod, kubectl picks the first container (or the one named in the `kubectl.kubernetes.io/default-container` annotation) and prints a "Defaulted container ..." notice. That may not be the one you want, so always specify `-c`.

---

## Quick Reference

### Differences Between Patterns

| Pattern | Where | restartPolicy | When It Runs |
|---|---|---|---|
| Co-located | `containers:` | N/A (always runs) | In parallel with main |
| Init Container | `initContainers:` | N/A (runs and exits) | Before main, sequentially |
| Native Sidecar | `initContainers:` | `Always` | Before main, stays running |
| Ambassador | `containers:` | N/A | In parallel with main |
| Adapter | `containers:` | N/A | In parallel with main |

### Essential Commands
```bash
# Logs of a specific container
k logs pod-name -c container-name
k logs pod-name -c container-name -f     # Stream
k logs pod-name -c container-name -p     # Previous

# Exec in a specific container
k exec -it pod-name -c container-name -- /bin/sh
k exec pod-name -c container-name -- cat /log/app.log

# Check the state of init containers
k describe pod pod-name

# Create a pod with a shared volume (generate YAML and edit)
k run multi-pod --image=nginx --dry-run=client -o yaml > pod.yaml
```

### Multi-Container Pod Template
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-pod
spec:
  containers:
  - name: main-app
    image: main-app-image
    ports:
    - containerPort: 8080
    volumeMounts:
    - name: shared-data
      mountPath: /var/data
  - name: sidecar
    image: sidecar-image
    volumeMounts:
    - name: shared-data
      mountPath: /var/data
  initContainers:
  - name: init-setup
    image: busybox
    command: ['sh', '-c', 'echo setup done']
  volumes:
  - name: shared-data
    emptyDir: {}
```

### run ≠ create ≠ apply

| Command | Action |
|---|---|
| `kubectl run` | Creates only Pods |
| `kubectl create` | Creates resources (fails if they already exist) |
| `kubectl apply` | Creates or updates resources (idempotent) |

### Study Checklist - Multi-Container Pods
- [ ] I can add multiple containers to a pod
- [ ] I know the difference between init containers and sidecar containers
- [ ] I can use `restartPolicy: Always` for native sidecars
- [ ] I can share data between containers via `emptyDir`
- [ ] I can identify the patterns (co-located, sidecar, ambassador, adapter)
- [ ] I can view logs and run commands in specific containers
- [ ] I can debug init containers
