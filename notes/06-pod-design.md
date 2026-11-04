# Pod Design

> CKAD domain: Application Deployment (20%), Application Design and Build (20%)

## Table of Contents
1. [Labels & Selectors](#labels--selectors)
2. [Annotations](#annotations)
3. [Rolling Updates & Rollbacks](#rolling-updates--rollbacks)
4. [Deployment Strategies](#deployment-strategies)
5. [Jobs](#jobs)
6. [CronJobs](#cronjobs)
7. [Common Exam Scenarios](#common-exam-scenarios)
8. [Quick Reference](#quick-reference)

---

## Labels & Selectors

### Labels
Key-value pairs attached to Kubernetes objects. Used to organize, group and select resources.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: simple-webapp
  labels:
    app: App1
    function: Front-end
    env: production
spec:
  containers:
  - name: simple-webapp
    image: nginx
    ports:
    - containerPort: 80
```

### Selectors
Used to filter/select objects based on their labels.

```bash
# Filter by one label
kubectl get pods --selector app=App1
kubectl get pods -l app=App1                # Shorthand

# Filter by multiple labels (AND)
kubectl get pods -l app=App1,env=production

# Filter across the common resource types
# (note: "all" covers common workload resources such as pods, services, deployments, replicasets, jobs - not every kind)
kubectl get all --selector env=prod,bu=finance,tier=frontend

# Count pods with a label
kubectl get pods -l env=prod --no-headers | wc -l
```

### Labels in ReplicaSets and Deployments
There are **two levels** of labels - do not mix them up:

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: simple-webapp
  labels:                    # Labels of the ReplicaSet itself
    app: App1
    function: Front-end
spec:
  replicas: 3
  selector:
    matchLabels:
      app: App1              # Must match the labels of the Pod template
  template:
    metadata:
      labels:                # Labels of the Pods that get created
        app: App1
        function: Front-end
    spec:
      containers:
      - name: simple-webapp
        image: nginx
```

**EXAM TIP:** `selector.matchLabels` is what links a ReplicaSet/Deployment to its Pods. If the labels do not match, the Pods are not managed (and the API server rejects the object if the selector does not match the template labels). The same logic applies to Services.

### Label Commands
```bash
# Add a label
kubectl label pod myapp-pod tier=frontend

# Change an existing label
kubectl label pod myapp-pod tier=backend --overwrite

# Remove a label
kubectl label pod myapp-pod tier-

# Show labels
kubectl get pods --show-labels
```

---

## Annotations

Informational metadata that is NOT used for selection. Used to store auxiliary information (build version, contact, integration tooling, etc.).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: simple-webapp
  labels:
    app: App1
  annotations:
    buildversion: "1.34"
    owner: "team-frontend"
    description: "Main webapp deployment"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: App1
  template:
    metadata:
      labels:
        app: App1
    spec:
      containers:
      - name: simple-webapp
        image: nginx
```

**EXAM TIP:** Labels = selection/filtering. Annotations = information only. Annotations show up less often in exam tasks, but you must know the difference.

```bash
# Add an annotation
kubectl annotate pod myapp-pod description="Main app"

# Remove an annotation
kubectl annotate pod myapp-pod description-
```

---

## Rolling Updates & Rollbacks

### Concept
When a Deployment is updated, the following is created:
1. A new **Rollout**
2. A new **ReplicaSet**
3. A new **Deployment Revision**

Kubernetes creates Pods in the new ReplicaSet while removing Pods from the old one, which (with sensible `maxUnavailable`/readiness probes) avoids downtime.

### Rollout Commands
```bash
# Check rollout status
kubectl rollout status deployment/myapp-deployment

# Show revision history
kubectl rollout history deployment/myapp-deployment

# Show details of a specific revision
kubectl rollout history deployment/myapp-deployment --revision=1

# Roll back to the previous revision
kubectl rollout undo deployment/myapp-deployment

# Roll back to a specific revision
kubectl rollout undo deployment/myapp-deployment --to-revision=2

# Pause/resume a rollout
kubectl rollout pause deployment/myapp-deployment
kubectl rollout resume deployment/myapp-deployment

# Restart the deployment (rolling restart: all Pods are replaced gradually)
kubectl rollout restart deployment/myapp-deployment
```

**NOTE:** The `CHANGE-CAUSE` column in `rollout history` is filled from the `kubernetes.io/change-cause` annotation. The old `--record` flag is deprecated; set the annotation instead:
```bash
kubectl annotate deployment/myapp-deployment kubernetes.io/change-cause="update to nginx 1.25"
```

### Updating a Deployment
```bash
# Method 1: Edit the file and apply it
kubectl apply -f deployment-definition.yml

# Method 2: Change the image directly
kubectl set image deployment/myapp-deployment nginx=nginx:1.25

# Method 3: Edit interactively
kubectl edit deployment myapp-deployment
```

**EXAM TIP:** `kubectl set image` is the fastest way to update an image version. Note that it does not update your YAML file.

### Inspecting what happened
```bash
kubectl get replicasets       # You will see the old one (0 pods) and the new one (N pods)
kubectl describe deployment myapp-deployment  # Detailed events
```

---

## Deployment Strategies

### 1. Recreate
Kills **all** existing pods before creating new ones. Causes **downtime**.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  strategy:
    type: Recreate
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v2
```

### 2. Rolling Update (Default)
Replaces pods gradually. **No downtime** (as long as new pods become Ready).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%           # Extra pods allowed during the update (default 25%)
      maxUnavailable: 25%     # Pods that may be unavailable during the update (default 25%)
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v2
```

| Parameter | Description | Accepts |
|---|---|---|
| `maxSurge` | How many pods **above** the desired count may exist during the update (percentages round up) | Number or % |
| `maxUnavailable` | How many pods may be **unavailable** during the update (percentages round down) | Number or % |

**Example:** 10 replicas with `maxSurge: 2` and `maxUnavailable: 1`
- Maximum during the update: 12 pods (10 + 2)
- Minimum available during the update: 9 pods (10 - 1)

**EXAM TIP:** If the task asks for "no downtime", use Rolling Update. If it asks for a full replacement, use Recreate.

### 3. Blue/Green

Two deployments coexist. The Service points to the old version (Blue). After testing the new version (Green), the Service is switched over.

**Implementation:**
```bash
# 1. Blue Deployment (v1) running with label version=v1
# 2. Service selects version=v1
# 3. Create Green Deployment (v2) with label version=v2
# 4. Test Green
# 5. Change the Service selector to version=v2
```

```yaml
# Service (points to the active version)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: frontend
    version: v2       # Change from v1 to v2 to switch over
  ports:
  - port: 80
```

### 4. Canary

Most traffic goes to the old version, a small percentage to the new one. If everything goes well, a full rolling update follows.

**Implementation:**
```yaml
# Primary Deployment (5 replicas)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-primary
spec:
  replicas: 5
  selector:
    matchLabels:
      app: frontend
      version: v1             # Keeps the two Deployments' selectors from overlapping
  template:
    metadata:
      labels:
        app: frontend           # Common label
        version: v1
    spec:
      containers:
      - name: myapp
        image: myapp:v1
```

```yaml
# Canary Deployment (1 replica)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
      version: v2
  template:
    metadata:
      labels:
        app: frontend           # Same common label!
        version: v2
    spec:
      containers:
      - name: myapp
        image: myapp:v2
```

```yaml
# Service selects the common label (receives traffic from both)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: frontend               # Label shared by both deployments
  ports:
  - port: 80
```

With 5+1 pods, roughly 17% of the traffic goes to the canary (the split follows the pod ratio, it is not an exact percentage). After validation:
```bash
# Scale the canary to 0 and update the primary
kubectl scale deployment myapp-canary --replicas=0
kubectl set image deployment/myapp-primary myapp=myapp:v2
```

**EXAM TIP:** The key to Canary is a **common label** shared by both deployments that the Service uses as its selector. Give each Deployment's own `selector` a distinguishing label too, so the Deployments do not select each other's pods.

---

## Jobs

### Why Jobs?
Some workloads should run and **finish** (batch processing, calculations, migrations). With regular pods (`restartPolicy: Always`), the container restarts endlessly after completing.

### Basic Example
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: math-add-job
spec:
  template:
    spec:
      containers:
      - name: math-add
        image: ubuntu
        command: ['expr', '3', '+', '2']
      restartPolicy: Never      # Jobs require Never or OnFailure
```

### Important Parameters

| Parameter | Default | Description |
|---|---|---|
| `completions` | 1 | Number of successful completions required |
| `parallelism` | 1 | How many pods run at the same time |
| `backoffLimit` | 6 | Retries before the Job is marked as failed |
| `activeDeadlineSeconds` | - | Maximum time (in seconds) for the whole Job |
| `ttlSecondsAfterFinished` | - | Auto-delete N seconds after the Job finishes |

### Job with Multiple Completions and Parallelism
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: math-add-job
spec:
  completions: 3              # Needs 3 successful completions
  parallelism: 3              # Runs 3 pods at the same time
  backoffLimit: 25            # 25 retries before giving up
  activeDeadlineSeconds: 120  # Maximum 2 minutes
  template:
    spec:
      containers:
      - name: math-add
        image: ubuntu
        command: ['expr', '3', '+', '2']
      restartPolicy: Never
```

**How completions behave:** If 3 completions are required but only 2 succeed, the Job keeps creating pods until 3 have succeeded (or `backoffLimit` is reached).

### Job Commands
```bash
# Create (imperative)
kubectl create job my-job --image=ubuntu -- expr 3 + 2

# Generate YAML without creating
kubectl create job my-job --image=ubuntu --dry-run=client -o yaml > job.yaml

# List jobs
kubectl get jobs

# List the job's pods
kubectl get pods              # Pod name = job-name-xxxxx

# View output
kubectl logs job-pod-name

# Delete a job (also deletes its pods)
kubectl delete job my-job
```

**EXAM TIP:** `kubectl create job` is the fastest way. To generate YAML and edit it: `kubectl create job name --image=image --dry-run=client -o yaml > job.yaml`

---

## CronJobs

Jobs that run on a **schedule**.

### Structure (3 levels of spec)
```
CronJob spec → jobTemplate spec → template spec → containers
```

### Complete Example
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: reporting-cron-job
spec:
  schedule: "*/1 * * * *"          # Every minute
  concurrencyPolicy: Forbid        # Do not allow concurrent runs
  successfulJobsHistoryLimit: 3    # Keep the last 3 successful jobs
  failedJobsHistoryLimit: 1        # Keep the last failed job
  jobTemplate:
    spec:
      completions: 3
      parallelism: 3
      backoffLimit: 25
      template:
        spec:
          containers:
          - name: reporting-tool
            image: busybox
            command: ['echo', 'generating report']
          restartPolicy: Never
```

### Cron Schedule Syntax

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of the week (0 - 6, Sunday=0)
│ │ │ │ │
* * * * *
```

| Example | Meaning |
|---|---|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour (at minute 0) |
| `0 21 * * *` | Every day at 21:00 |
| `30 21 * * *` | Every day at 21:30 |
| `0 */2 * * *` | Every 2 hours |
| `0 8 * * 1-5` | Weekdays at 08:00 |
| `0 0 1 * *` | First day of every month at midnight |
| `0 0 * * 0` | Every Sunday at midnight |

### CronJob Parameters

| Parameter | Default | Description |
|---|---|---|
| `concurrencyPolicy` | `Allow` | `Allow`, `Forbid`, `Replace` |
| `startingDeadlineSeconds` | - | Maximum delay allowed for starting a missed run |
| `successfulJobsHistoryLimit` | 3 | How many successful jobs to keep |
| `failedJobsHistoryLimit` | 1 | How many failed jobs to keep |
| `suspend` | false | Suspend future runs |
| `timeZone` | - | Time zone for the schedule (e.g. `Europe/Lisbon`); by default the schedule uses the time zone of the kube-controller-manager |

**concurrencyPolicy:**
- `Allow` → Allows concurrent runs
- `Forbid` → Skips the new run if the previous one is still running
- `Replace` → Cancels the running job and starts a new one

### CronJob Commands
```bash
# Create (imperative)
kubectl create cronjob my-cron --image=busybox --schedule="*/5 * * * *" -- echo "hello"

# Generate YAML
kubectl create cronjob my-cron --image=busybox --schedule="0 21 * * *" --dry-run=client -o yaml > cron.yaml

# List cronjobs
kubectl get cronjobs                 # or kubectl get cj

# List jobs created by the cronjob
kubectl get jobs

# Suspend/resume
kubectl patch cronjob my-cron -p '{"spec":{"suspend":true}}'
kubectl patch cronjob my-cron -p '{"spec":{"suspend":false}}'
```

**EXAM TIP:** Watch the indentation of a CronJob - there are 3 nested levels of `spec`. Use `kubectl create cronjob --dry-run=client -o yaml` to generate the template and then edit it.

---

## Common Exam Scenarios

### 1. Create a deployment and roll out a new version
```bash
kubectl create deployment webapp --image=nginx:1.21 --replicas=3
kubectl set image deployment/webapp nginx=nginx:1.25
kubectl rollout status deployment/webapp
```

### 2. Roll back to the previous version
```bash
kubectl rollout history deployment/webapp
kubectl rollout undo deployment/webapp
# or to a specific revision:
kubectl rollout undo deployment/webapp --to-revision=2
```

### 3. Create a Job that runs 5 times with parallelism of 2
```bash
kubectl create job my-job --image=busybox --dry-run=client -o yaml > job.yaml
# Edit: add completions: 5 and parallelism: 2
kubectl apply -f job.yaml
```

### 4. Filter resources by multiple labels
```bash
kubectl get all -l env=prod,tier=frontend
kubectl get pods -l 'env in (prod,staging)'
```

### 5. Scale a deployment
```bash
kubectl scale deployment webapp --replicas=5
```

### 6. Check that a deployment uses Rolling Update
```bash
kubectl describe deployment webapp | grep -i strategy
```

---

## Quick Reference

### Deployment Strategy Comparison

| Strategy | Downtime | Rollback | Complexity |
|---|---|---|---|
| **Recreate** | Yes | `kubectl rollout undo` (again with downtime) | Low |
| **Rolling Update** | No | `kubectl rollout undo` | Low |
| **Blue/Green** | No | Switch the Service selector back | Medium |
| **Canary** | No | Scale the canary to 0 | High |

### All Imperative Commands

```bash
# k = alias for kubectl
# === LABELS & SELECTORS ===
k get pods -l app=myapp                  # Filter by label
k get pods -l app=myapp,env=prod         # Multiple labels
k get all -l env=prod                    # Common resource types
k get pods --show-labels                 # Show labels
k label pod myapp tier=frontend          # Add a label
k label pod myapp tier-                  # Remove a label
k annotate pod myapp desc="info"         # Add an annotation

# === ROLLOUTS ===
k rollout status deploy/myapp
k rollout history deploy/myapp
k rollout history deploy/myapp --revision=1
k rollout undo deploy/myapp
k rollout undo deploy/myapp --to-revision=2
k rollout restart deploy/myapp
k rollout pause deploy/myapp
k rollout resume deploy/myapp

# === DEPLOYMENTS ===
k create deploy myapp --image=nginx --replicas=3
k set image deploy/myapp nginx=nginx:1.25
k scale deploy myapp --replicas=5
k edit deploy myapp

# === JOBS ===
k create job my-job --image=busybox -- echo "hello"
k create job my-job --image=busybox --dry-run=client -o yaml > job.yaml
k get jobs
k logs job-pod-name
k delete job my-job

# === CRONJOBS ===
k create cronjob my-cron --image=busybox --schedule="*/5 * * * *" -- echo "hello"
k create cronjob my-cron --image=busybox --schedule="0 21 * * *" --dry-run=client -o yaml > cron.yaml
k get cj
k delete cj my-cron
```

### Job Template
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
spec:
  completions: 3
  parallelism: 2
  backoffLimit: 6
  activeDeadlineSeconds: 120
  template:
    spec:
      containers:
      - name: worker
        image: busybox
        command: ['echo', 'hello']
      restartPolicy: Never
```

### CronJob Template
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
spec:
  schedule: "0 21 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: worker
            image: busybox
            command: ['echo', 'hello']
          restartPolicy: Never
```

### Study Checklist
- [ ] I can use labels and selectors to filter resources
- [ ] I know the difference between labels and annotations
- [ ] I know the 4 deployment strategies (Recreate, Rolling, Blue/Green, Canary)
- [ ] I can configure maxSurge and maxUnavailable
- [ ] I can perform a rollout, view the history and roll back
- [ ] I can create Jobs with completions and parallelism
- [ ] I can create CronJobs with a correct schedule
- [ ] I know the cron syntax (minute hour day month weekday)
- [ ] I can use imperative commands for Jobs and CronJobs
