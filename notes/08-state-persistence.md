# State Persistence

> CKAD domain: Application Design and Build (20%)

## Table of Contents
1. [Storage in Docker](#storage-in-docker)
2. [Volumes in Kubernetes](#volumes-in-kubernetes)
3. [Persistent Volumes (PV)](#persistent-volumes-pv)
4. [Persistent Volume Claims (PVC)](#persistent-volume-claims-pvc)
5. [Using PVCs in Pods](#using-pvcs-in-pods)
6. [Storage Classes](#storage-classes)
7. [Common Exam Scenarios](#common-exam-scenarios)
8. [Quick Reference](#quick-reference)

---

## Storage in Docker

### File System
Docker stores everything under `/var/lib/docker`:
- `/overlay2` — image layers (the default storage driver; older installs use `/aufs`)
- `/containers` — container data
- `/image` — image metadata
- `/volumes` — created volumes

### Layered Architecture
Each Dockerfile instruction creates a new layer. Docker reuses earlier layers that have not changed (cache).

### Docker Volumes
```bash
# Create a volume
docker volume create data_volume

# Volume mounting (volume managed by Docker)
docker run -v data_volume:/var/lib/mysql mysql

# Bind mounting (any directory on the host)
docker run -v /data/mysql:/var/lib/mysql mysql

# Modern syntax (recommended)
docker run --mount type=bind,source=/data/mysql,target=/var/lib/mysql mysql
```

### Storage Drivers vs Volume Drivers
- **Storage Drivers**: Manage layers and writes (AUFS, ZFS, BTRFS, Device Mapper, Overlay2)
- **Volume Drivers**: Manage volumes (Local, Azure File Storage, NetApp, third-party plugins, etc.)

```bash
# Cloud volume via a third-party volume plugin (illustrative; rexray/ebs is no longer maintained)
docker run -it \
  --name mysql \
  --volume-driver rexray/ebs \
  --mount src=ebs-vol,target=/var/lib/mysql mysql
```
The container can die, but the data remains in the cloud.

---

## Volumes in Kubernetes

### Problem
When a pod is removed, all data inside its containers is **lost**. To persist data, we attach a **Volume** to the pod.

### Volume Types

| Type | Description | Persistence |
|---|---|---|
| `emptyDir` | Created with the pod, deleted with the pod (survives container restarts) | Temporary |
| `hostPath` | Directory on the host node | Persists on the node |
| `nfs` | Network File System | Network (persistent) |
| `csi` | Volume provided by a CSI driver (AWS EBS, GCE PD, Azure Disk, ...), normally consumed through a PV/PVC | Cloud / external (persistent) |
| `persistentVolumeClaim` | Reference to a PVC | Depends on the PV |

**NOTE:** The old in-tree cloud volume types (`awsElasticBlockStore`, `gcePersistentDisk`, `azureDisk`) have been removed from current Kubernetes releases; use the corresponding CSI drivers instead.

### emptyDir (temporary, shared between containers)
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-pod
spec:
  containers:
  - name: writer
    image: busybox
    command: ['sh', '-c', 'echo hello > /data/msg.txt && sleep 3600']
    volumeMounts:
    - mountPath: /data
      name: shared-volume
  - name: reader
    image: busybox
    command: ['sh', '-c', 'cat /data/msg.txt && sleep 3600']
    volumeMounts:
    - mountPath: /data
      name: shared-volume
  volumes:
  - name: shared-volume
    emptyDir: {}
```

**EXAM TIP:** `emptyDir` is ideal for sharing data between containers in the same pod (e.g. a logging sidecar). It is deleted when the pod is removed.

### hostPath (persists on the node)
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: random-number-generator
spec:
  containers:
  - name: alpine
    image: alpine
    command: ["/bin/sh", "-c"]
    args: ["shuf -i 0-100 -n 1 >> /opt/number.out;"]
    volumeMounts:
    - mountPath: /opt
      name: data-volume
  volumes:
  - name: data-volume
    hostPath:
      path: /data
      type: Directory
```

**NOTE:** `hostPath` does not work well on multi-node clusters because the data only lives on the node where the pod ran. It also exposes the node's file system to the pod, so avoid it outside of single-node/test setups.

### Cloud Volumes
Cloud block storage (AWS EBS, GCE PD, Azure Disk, ...) is consumed through a CSI driver, using a PV/PVC or a StorageClass (see below) rather than a volume defined directly in the pod.

**Problem:** Defining storage directly in each pod is repetitive and hard to manage. Solution → **Persistent Volumes + PVCs**.

---

## Persistent Volumes (PV)

A **PV** is a cluster-level storage resource, provisioned by an administrator (or dynamically via a StorageClass). It is independent of any pod.

### Complete Example
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-vol1
spec:
  accessModes:
  - ReadWriteOnce
  capacity:
    storage: 1Gi
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /tmp/data
```

### With a CSI driver (AWS EBS example)
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-vol1
spec:
  accessModes:
  - ReadWriteOnce
  capacity:
    storage: 1Gi
  persistentVolumeReclaimPolicy: Retain
  csi:
    driver: ebs.csi.aws.com
    volumeHandle: <volume-id>
    fsType: ext4
```

### Access Modes

| Mode | Abbreviation | Description |
|---|---|---|
| `ReadWriteOnce` | RWO | Read/write by a **single node** |
| `ReadOnlyMany` | ROX | Read-only by **multiple nodes** |
| `ReadWriteMany` | RWX | Read/write by **multiple nodes** |
| `ReadWriteOncePod` | RWOP | Read/write by a **single pod** only |

**EXAM TIP:** The PVC's `accessModes` must be compatible with the PV's. If the PV is RWO, the PVC must also request RWO. This is a common mistake.

### Reclaim Policies

| Policy | Description |
|---|---|
| `Retain` | PV is kept, with its data, after the PVC is deleted; it moves to `Released` and cannot be claimed again until an admin cleans it up (default for manually created PVs) |
| `Delete` | PV and the underlying storage are deleted when the PVC is removed (default for dynamically provisioned PVs, via the StorageClass `reclaimPolicy`) |
| `Recycle` | Deprecated (basic scrub, then PV becomes available again); use dynamic provisioning instead |

### PV Commands
```bash
kubectl create -f pv-definition.yaml
kubectl get persistentvolume               # or kubectl get pv
kubectl describe pv pv-vol1
kubectl delete pv pv-vol1
```

---

## Persistent Volume Claims (PVC)

A **PVC** is a storage request made by a user/pod. Kubernetes **binds** a PVC to a PV automatically, based on:
1. **Capacity** — the PV is large enough
2. **Access Modes** — compatible
3. **Storage Class** — must match (see below)
4. **Labels/Selectors** — if used

### Complete Example
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

### PVC with a Label Selector (when there are multiple PVs)
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
  selector:
    matchLabels:
      environment: production
```

### Binding Rules
- **1 PVC = 1 PV** (one-to-one relationship)
- If the PVC asks for 500Mi but the only available PV has 1Gi → it **still binds** (the wasted space is accepted)
- If there is no compatible PV → the PVC stays **Pending**
- If several PVs are compatible → Kubernetes picks the best match (or use labels)
- If the PVC omits `storageClassName` and the cluster has a **default StorageClass**, the default class is applied and a PV is provisioned dynamically instead of binding to a manually created classless PV. To bind only to static PVs, set `storageClassName: ""` on the PVC (and leave it unset on the PV).

### PVC Commands
```bash
kubectl create -f pvc-definition.yaml
kubectl get persistentvolumeclaim            # or kubectl get pvc
kubectl describe pvc myclaim
kubectl delete persistentvolumeclaim myclaim

# Check binding status
kubectl get pv,pvc
```

**EXAM TIP:** When you delete a PVC, what happens to the PV depends on `persistentVolumeReclaimPolicy`: Retain (keeps it), Delete (removes it), Recycle (scrubs the data, deprecated).

---

## Using PVCs in Pods

### Pod with a PVC
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  containers:
  - name: myfrontend
    image: nginx
    volumeMounts:
    - mountPath: /var/www/html
      name: mypd
  volumes:
  - name: mypd
    persistentVolumeClaim:
      claimName: myclaim
```

### Deployment with a PVC
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 1
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
        image: nginx
        volumeMounts:
        - mountPath: /var/www/html
          name: web-storage
      volumes:
      - name: web-storage
        persistentVolumeClaim:
          claimName: myclaim
```

**EXAM TIP:** `volumes` and `volumeMounts` are different fields! `volumes` defines the volume at the pod level, `volumeMounts` mounts it inside the container. The `name` must match in both.

### Complete Flow: PV → PVC → Pod
```
1. Admin creates a PV (1Gi, RWO, hostPath)
2. Dev creates a PVC (500Mi, RWO) → Kubernetes binds it to the PV
3. Dev creates a Pod with volumes.persistentVolumeClaim.claimName
4. The Pod uses the volume mounted at mountPath
```

---

## Storage Classes

### Problem
Creating PVs manually before the PVCs is **static provisioning**. In cloud environments this is inefficient.

### Solution: Dynamic Provisioning
With a **StorageClass**, PVs are created **automatically** when a PVC is created.

### StorageClass Example
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: google-storage
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-standard
  replication-type: none
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

### Common Provisioners

| Provider | Provisioner |
|---|---|
| AWS EBS | `ebs.csi.aws.com` |
| GCE PD | `pd.csi.storage.gke.io` |
| Azure Disk | `disk.csi.azure.com` |
| NFS | `nfs.csi.k8s.io` (csi-driver-nfs) |
| Local | `kubernetes.io/no-provisioner` |

A cluster can mark one StorageClass as the default with the annotation `storageclass.kubernetes.io/is-default-class: "true"`; PVCs that omit `storageClassName` use it.

### PVC with a StorageClass
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: google-storage
  resources:
    requests:
      storage: 500Mi
```

**EXAM TIP:** With a `storageClassName` that has a provisioner, you do NOT need to create the PV manually — the StorageClass creates it automatically (dynamic provisioning). If the PVC omits `storageClassName`, the cluster's default StorageClass (if any) is used; use `storageClassName: ""` to force binding to a pre-created static PV.

### volumeBindingMode

| Mode | Description |
|---|---|
| `Immediate` | PV is provisioned and bound as soon as the PVC is created (default) |
| `WaitForFirstConsumer` | Provisioning and binding wait until a pod uses the PVC |

**EXAM TIP:** `WaitForFirstConsumer` matters when PVs depend on the zone/region of the node (e.g. cloud). It ensures the PV is created in the same zone as the pod.

### Local StorageClass (no provisioner)
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

With the `no-provisioner` provisioner, PVs are NOT created automatically — you must create them manually. But the `storageClassName` ensures the PVC only binds to PVs of that class.

---

## Common Exam Scenarios

### 1. Create PV + PVC + Pod (the most common scenario)
```bash
# 1. Create the PV
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-log
spec:
  accessModes:
  - ReadWriteMany
  capacity:
    storage: 100Mi
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /pv/log
EOF

# 2. Create the PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: claim-log-1
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 50Mi
EOF

# 3. Check the binding
# (if the cluster has a default StorageClass, add storageClassName: "" to the PVC so it binds to this static PV)
kubectl get pv,pvc
```

### 2. Add a volume to an existing pod
```bash
kubectl get pod webapp -o yaml > pod.yaml
# Edit pod.yaml:
#   - Add volumeMounts to the container
#   - Add volumes to the pod spec
kubectl replace --force -f pod.yaml
```

### 3. PVC stays Pending — troubleshoot
```bash
kubectl get pvc                    # Check the status
kubectl describe pvc myclaim       # Check the events
# Common causes:
# - No PV with enough capacity
# - Incompatible accessModes
# - storageClassName does not match
```

### 4. View the contents of a mounted volume
```bash
kubectl exec webapp -- cat /log/app.log
kubectl exec -it webapp -- ls /var/www/html
```

### 5. Generate Pod YAML with dry-run and add a volume
```bash
kubectl run webapp --image=busybox --dry-run=client -o yaml \
  -- sh -c 'while true; do date >> /log/app.log; sleep 5; done' > webapp.yaml
# Edit webapp.yaml → add volumes + volumeMounts (mount at /log)
kubectl apply -f webapp.yaml
```

---

## Quick Reference

### Essential Commands
```bash
# k = alias for kubectl
# === PERSISTENT VOLUMES ===
k get pv                                    # List PVs
k describe pv pv-name                       # Details
k delete pv pv-name                         # Delete

# === PERSISTENT VOLUME CLAIMS ===
k get pvc                                   # List PVCs
k describe pvc pvc-name                     # Details
k delete pvc pvc-name                       # Delete

# === STORAGE CLASSES ===
k get storageclass                          # or k get sc
k describe sc sc-name                       # Details

# === VIEW EVERYTHING ===
k get pv,pvc                                # PVs and PVCs together
k get pv,pvc,sc                             # Include StorageClasses

# === DEBUG ===
k exec pod-name -- cat /path/to/file        # Read a file on the volume
k exec -it pod-name -- ls /mount/path       # List a directory
k describe pod pod-name                     # Show mounts and volumes
k get events                                # Binding events

# === GENERATE YAML ===
k run pod-name --image=image --dry-run=client -o yaml > pod.yaml
# Then edit it to add volumes + volumeMounts
```

### PV Template
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-vol1
spec:
  accessModes:
  - ReadWriteOnce
  capacity:
    storage: 1Gi
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /tmp/data
```

### PVC Template
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: myclaim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

### Pod with PVC Template
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  containers:
  - name: myapp
    image: nginx
    volumeMounts:
    - mountPath: /var/www/html
      name: web-storage
  volumes:
  - name: web-storage
    persistentVolumeClaim:
      claimName: myclaim
```

### StorageClass Template
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: pd.csi.storage.gke.io
parameters:
  type: pd-ssd
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

### Decision Flow

```
Do I need storage?
├── Temporary (shared between containers) → emptyDir
├── Persistent on the node (single-node) → hostPath
└── Persistent (multi-node, production) →
    ├── Static Provisioning → Create PV → Create PVC → Use in the Pod
    └── Dynamic Provisioning → Create StorageClass → Create PVC → Use in the Pod
```

### Access Modes Cheat Sheet
```
RWO  = ReadWriteOnce     → 1 node reads/writes
ROX  = ReadOnlyMany      → N nodes read
RWX  = ReadWriteMany     → N nodes read/write
RWOP = ReadWriteOncePod  → 1 pod reads/writes
```

### Study Checklist
- [ ] I know the difference between emptyDir, hostPath and PVC
- [ ] I can create a PV with accessModes and capacity
- [ ] I can create a PVC and understand the binding mechanism
- [ ] I can mount a PVC in a Pod (volumes + volumeMounts)
- [ ] I know the name must match between volumes and volumeMounts
- [ ] I know the access modes (RWO, ROX, RWX, RWOP)
- [ ] I know the reclaim policies (Retain, Delete; Recycle is deprecated)
- [ ] I know what a StorageClass and dynamic provisioning are
- [ ] I can use volumeBindingMode (Immediate vs WaitForFirstConsumer)
- [ ] I can troubleshoot a PVC in Pending state
- [ ] I can use --dry-run=client -o yaml to generate base YAML
