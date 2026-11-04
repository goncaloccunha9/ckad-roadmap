# Kustomize

> CKAD domain: Application Deployment (20%)

## Table of Contents
1. [What is Kustomize](#what-is-kustomize)
2. [Kustomize vs Helm](#kustomize-vs-helm)
3. [Installation](#installation)
4. [kustomization.yaml - Basic Structure](#kustomizationyaml---basic-structure)
5. [Build vs Apply](#build-vs-apply)
6. [Managing Multiple Directories](#managing-multiple-directories)
7. [Common Transformers](#common-transformers)
8. [Image Transformers](#image-transformers)
9. [Generators](#generators)
10. [Patches](#patches)
11. [Overlays (Base + Overlays Pattern)](#overlays-base--overlays-pattern)
12. [Common Exam Scenarios](#common-exam-scenarios)
13. [Quick Reference](#quick-reference)

---

## What is Kustomize

### The problem
You have an application running in **dev**, **staging** and **prod**. The YAML files are almost identical, but:
- **Dev** has 1 replica, **Prod** has 10
- **Dev** uses image `nginx:dev`, **Prod** uses `nginx:1.25`
- Each environment has different labels and namespaces

Without a tool, you would have to duplicate the YAML for every environment.

### The solution: Kustomize
Kustomize lets you **customize YAML configs without duplicating them**, using:
- **Transformers** that add prefixes, suffixes, labels and namespaces
- **Patches** that change specific fields
- **Overlays** that apply per-environment differences

**Philosophy:** Keep a plain "base" YAML and apply layers of modifications on top.

### Built into kubectl
Kustomize has been **built into kubectl** since version 1.14:
```bash
kubectl apply -k ./
kubectl kustomize ./
```

You don't need to install anything extra.

---

## Kustomize vs Helm

| | Helm | Kustomize |
|---|---|---|
| Approach | Templates with placeholders | Overlays and patches on plain YAML |
| Syntax | Go templates (`{{ .Values.x }}`) | Plain YAML |
| Extra installation | Yes (helm CLI) | No (built into kubectl) |
| Releases / rollback | Yes (`helm rollback`) | No release tracking (for Deployments, use `kubectl rollout undo`) |
| Repositories | Yes (charts in repos/hubs) | No (local files or remote Git references) |
| Complexity | Higher for complex charts | Lower, declarative |

**EXAM TIP:** Expect fairly simple Kustomize tasks - applying an overlay, changing an image, adding a prefix. For Helm, be fluent with install, upgrade, rollback and uninstall.

---

## Installation

### Built into kubectl (recommended for the exam)
Already available - just use `kubectl apply -k` or `kubectl kustomize`.

### Standalone CLI (optional)
```bash
# macOS
brew install kustomize

# Or the official install script
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
kustomize version
```

**NOTE:** The standalone CLI may be newer than the version bundled in kubectl. On the exam, use `kubectl apply -k` / `kubectl kustomize` so there is nothing to install.

---

## kustomization.yaml - Basic Structure

The file **MUST** be named `kustomization.yaml` (or `kustomization.yml` or `Kustomization`).

### Minimal example
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- nginx-deployment.yaml
- nginx-service.yaml

labels:
- pairs:
    company: acme
```

**EXAM TIP:** `apiVersion` and `kind` are **optional** but recommended. You may see them omitted in examples.

### Typical directory layout
```
k8s/
├── kustomization.yaml
├── nginx-deployment.yaml
└── nginx-service.yaml
```

Kustomize always looks for `kustomization.yaml` in the directory you point it at.

---

## Build vs Apply

### `kustomize build` / `kubectl kustomize` (display only)
Combines the manifests and applies the transformations, but **does NOT apply anything to the cluster**.

```bash
kubectl kustomize k8s/                 # Output to the terminal
kubectl kustomize k8s/ > final.yaml    # Save to a file
kustomize build k8s/                   # Same, with the standalone CLI
```

### Applying to the cluster

**Option 1: Pipe**
```bash
kubectl kustomize k8s/ | kubectl apply -f -
```

**Option 2: kubectl `-k` flag (RECOMMENDED)**
```bash
kubectl apply -k k8s/                  # One step, no pipe needed
```

### Deleting resources
```bash
kubectl kustomize k8s/ | kubectl delete -f -
kubectl delete -k k8s/                 # Equivalent
```

> **EXAM TIP:** `kubectl kustomize ./` is your best friend for validating before applying. It shows the final YAML with all transformations applied.

---

## Managing Multiple Directories

### The problem
When you have dozens of YAML files in subdirectories (api/, db/, cache/, kafka/, etc.), you don't want to apply them one by one.

### Option 1: One kustomization.yaml listing every path
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- api/api-deploy.yaml
- api/api-svc.yaml
- db/db-deploy.yaml
- db/db-svc.yaml
- cache/cache-deploy.yaml
- kafka/kafka-deploy.yaml
```

### Option 2: A kustomization.yaml per subdirectory (cleaner)
Each subdirectory has its own `kustomization.yaml`:

```
k8s/
├── kustomization.yaml         # Root (references the subdirectories)
├── api/
│   ├── kustomization.yaml
│   ├── api-deploy.yaml
│   └── api-svc.yaml
├── db/
│   ├── kustomization.yaml
│   ├── db-deploy.yaml
│   └── db-svc.yaml
└── cache/
    ├── kustomization.yaml
    └── cache-deploy.yaml
```

**Root `kustomization.yaml`:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- api/
- db/
- cache/
```

**`api/kustomization.yaml`:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- api-deploy.yaml
- api-svc.yaml
```

Apply everything at once:
```bash
kubectl apply -k k8s/
```

**EXAM TIP:** This hierarchy is the "monorepo style" pattern. Knowing it helps you organize complex configs.

---

## Common Transformers

Transformers apply changes **to ALL resources** in the kustomization.

### labels
Adds labels to all resources. By default the labels are added only to `metadata.labels`; the flags below control where else they go:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml

labels:
- pairs:
    app: myapp
    env: production
  includeSelectors: true     # Also add to selectors (Deployment, Service, ...) and Pod template labels
  # includeTemplates: true   # Alternative: add to Pod template labels only, leaving selectors untouched
```

> `commonLabels` is the older, deprecated way of doing this. It always modifies selectors, which is equivalent to `labels` with `includeSelectors: true`. It still works, but prefer `labels`.

### commonAnnotations
Adds an annotation to all resources:
```yaml
commonAnnotations:
  owner: team-platform
  build: "1.34"
```

### namePrefix / nameSuffix
Adds a prefix or suffix to all names:
```yaml
namePrefix: dev-
nameSuffix: -v1
```
A `Deployment` named `nginx` becomes `dev-nginx-v1`. References between resources (e.g. a Service selecting Pods, a Deployment mounting a ConfigMap) are updated automatically.

### namespace
Puts all resources in the same namespace:
```yaml
namespace: production
```

### Complete example
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml

namespace: production
namePrefix: prod-
labels:
- pairs:
    app: myapp
    env: prod
  includeSelectors: true
commonAnnotations:
  owner: platform-team
```

> **EXAM TIP:** Be careful: with `includeSelectors: true` (or the deprecated `commonLabels`) the label is added to the resources AND to the Deployment/Service selectors. A Deployment's selector is immutable, so changing it on an existing object fails. Add selector labels only when needed, and always read the output of `kubectl kustomize` before applying.

---

## Image Transformers

Replaces images in **all containers** that use that image.

### Original Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx
```

### kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- web-deploy.yaml

images:
- name: nginx
  newName: haproxy
  newTag: "2.4"
```

### Result after build
```yaml
spec:
  template:
    spec:
      containers:
      - name: web
        image: haproxy:2.4
```

**NOTE:** `name` matches the **original image name** (`nginx`), NOT the container `name`.

### Image transformer options
```yaml
images:
- name: nginx              # Original image
  newName: haproxy         # New image name (optional)
  newTag: "2.4"            # New tag (optional)
  digest: sha256:abc123    # Image digest (alternative to a tag)
```

You can use only `newTag` to change just the version:
```yaml
images:
- name: nginx
  newTag: "1.25"
```

---

## Generators

Generate ConfigMaps and Secrets from files or literals.

### configMapGenerator
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

configMapGenerator:
- name: app-config
  literals:
  - APP_COLOR=blue
  - APP_MODE=prod
- name: nginx-config
  files:
  - nginx.conf
```

### secretGenerator
```yaml
secretGenerator:
- name: app-secret
  literals:
  - DB_PASSWORD=passw0rd
  type: Opaque
- name: tls-secret
  files:
  - tls.crt
  - tls.key
  type: kubernetes.io/tls
```

**EXAM TIP:** Kustomize appends a **hash to the generated name** of the ConfigMap/Secret (e.g. `app-config-abc123`) and automatically updates references to it in the other resources. To disable the suffix:
```yaml
generatorOptions:
  disableNameSuffixHash: true
```

---

## Patches

**Surgical** modifications to specific fields. More precise than Common Transformers. All patches go under the single `patches` field.

> The older fields `patchesStrategicMerge` and `patchesJson6902` are deprecated. Use `patches` for both patch types; Kustomize detects the format from the content.

### Patch types

| Type | When to use |
|---|---|
| **JSON 6902** | Precise changes (add, remove, replace) addressed by path |
| **Strategic Merge Patch** | More natural, looks like regular YAML |

### JSON 6902 patch (op-based)

**Available operations:** `add`, `remove`, `replace`, `move`, `copy`, `test`

```yaml
patches:
- target:
    kind: Deployment
    name: api-deployment
  patch: |-
    - op: replace
      path: /metadata/name
      value: web-deployment
    - op: replace
      path: /spec/replicas
      value: 5
```

**Path:**
- `/metadata/name` → a single field
- `/spec/template/spec/containers/0/image` → the first container
- `/spec/template/spec/containers/-` → append to the end of the array

### Strategic Merge Patch (looks like regular YAML)
```yaml
patches:
- patch: |-
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: api-deployment
    spec:
      replicas: 5
```

You only include the fields you want to change - the rest is preserved.

### Patches in separate files
When you have many patches, split them into files:

```
k8s/
├── kustomization.yaml
├── deployment.yaml
└── patches/
    └── replica-patch.yaml
```

**kustomization.yaml:**
```yaml
patches:
- path: patches/replica-patch.yaml
  target:
    kind: Deployment
    name: api-deployment
```

**patches/replica-patch.yaml:**
```yaml
- op: replace
  path: /spec/replicas
  value: 5
```

### Target selectors
```yaml
patches:
- target:
    kind: Deployment           # By kind
    name: api-deployment       # By name
    namespace: production      # By namespace
    labelSelector: "app=myapp" # By labels
    version: v1                # By version
    group: apps                # By API group
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 3
```

### Patching lists (containers, ports, etc.)
To change a specific container in a list:
```yaml
patches:
- target:
    kind: Deployment
    name: api-deployment
  patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/image
      value: nginx:1.25
```

`/containers/0` → the first container
`/containers/-` → append to the end of the list

### Deleting a container
```yaml
patches:
- patch: |-
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: api-deployment
    spec:
      template:
        spec:
          containers:
          - $patch: delete
            name: memcached
```

> **EXAM TIP:** Strategic Merge Patch is **more natural** and more common. JSON 6902 is more surgical but requires knowing the JSON path. For the exam, focus on Strategic Merge, and know the JSON 6902 syntax too.

---

## Overlays (Base + Overlays Pattern)

The **main use** of Kustomize: keep a **common base** and per-environment variants.

### Layout
```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── nginx-deploy.yaml
│   └── nginx-svc.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   ├── volume.yaml
    │   └── config-map.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── prod/
        ├── kustomization.yaml
        ├── volume.yaml
        └── grafana-deployment.yaml
```

### base/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- nginx-deploy.yaml
- nginx-svc.yaml

labels:
- pairs:
    app: nginx
  includeSelectors: true
```

### overlays/dev/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base                  # Reference to the base

namespace: dev
namePrefix: dev-
labels:
- pairs:
    env: dev                  # metadata labels only (selectors untouched)

replicas:
- name: nginx
  count: 1

images:
- name: nginx
  newTag: latest
```

### overlays/prod/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

namespace: production
namePrefix: prod-
labels:
- pairs:
    env: prod

replicas:
- name: nginx
  count: 10

images:
- name: nginx
  newTag: "1.25"

patches:
- target:
    kind: Deployment
    name: nginx
  patch: |-
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: nginx
    spec:
      template:
        spec:
          containers:
          - name: nginx
            resources:
              requests:
                cpu: "500m"
                memory: "512Mi"
              limits:
                cpu: "1"
                memory: "1Gi"
```

### Applying per environment
```bash
kubectl apply -k overlays/dev/        # Applies base + dev overlay
kubectl apply -k overlays/prod/       # Applies base + prod overlay
```

> **EXAM TIP:** The `base + overlays` structure is the **classic Kustomize pattern** and the most likely to come up. Memorise the reference `resources: - ../../base`.

### The `replicas` field
Instead of writing a patch just to change the replica count:
```yaml
replicas:
- name: nginx
  count: 5
```
`name` is the name of the Deployment (or other scalable resource) as it appears in the base, before any `namePrefix`.

---

## Common Exam Scenarios

### 1. Apply an overlay
```bash
kubectl apply -k overlays/prod/
```

### 2. View the generated YAML without applying
```bash
kubectl kustomize overlays/dev/
```

### 3. Add a prefix to all resources
```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml

namePrefix: dev-
```

### 4. Change the image tag in all Deployments
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml

images:
- name: nginx
  newTag: "1.25"
```

### 5. Change replicas via a patch
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml

patches:
- target:
    kind: Deployment
    name: web
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 10
```

### 6. Generate a ConfigMap from literals
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

configMapGenerator:
- name: app-config
  literals:
  - APP_COLOR=blue
  - APP_MODE=prod
```

### 7. Delete everything applied by a kustomization
```bash
kubectl delete -k k8s/
```

### 8. Write a basic Kustomization from memory
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml

labels:
- pairs:
    app: myapp
  includeSelectors: true
namespace: production
namePrefix: prod-
images:
- name: nginx
  newTag: "1.25"
```

---

## Quick Reference

### Essential commands
```bash
# === BUILD (display only) ===
kubectl kustomize k8s/                            # Built-in
kustomize build k8s/                              # Standalone CLI

# === APPLY (to the cluster) ===
kubectl apply -k k8s/                             # Built-in (recommended)
kubectl kustomize k8s/ | kubectl apply -f -       # Via pipe

# === DELETE ===
kubectl delete -k k8s/
kubectl kustomize k8s/ | kubectl delete -f -

# === VALIDATE ===
kubectl kustomize k8s/ | kubectl apply --dry-run=client -f -

# === VERSION (standalone CLI) ===
kustomize version
```

### Minimal kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml
```

### Common transformers (full list)

| Transformer | What it does |
|---|---|
| `labels` | Adds labels to ALL resources (optionally to selectors/templates). Replaces the deprecated `commonLabels` |
| `commonAnnotations` | Adds annotations to ALL resources |
| `namePrefix` | Adds a prefix to names |
| `nameSuffix` | Adds a suffix to names |
| `namespace` | Sets the namespace for ALL resources |
| `images` | Replaces images in containers |
| `replicas` | Sets the replica count for Deployments and other scalable resources |

### Complete template (with overlays)

**base/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml

labels:
- pairs:
    app: myapp
  includeSelectors: true
```

**overlays/prod/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

namespace: production
namePrefix: prod-
labels:
- pairs:
    env: prod

replicas:
- name: myapp
  count: 5

images:
- name: nginx
  newTag: "1.25"

configMapGenerator:
- name: app-config
  literals:
  - APP_ENV=production

patches:
- target:
    kind: Deployment
    name: myapp
  patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/resources/limits/memory
      value: "1Gi"
```

### Helm vs Kustomize

| Criterion | Helm | Kustomize |
|---|---|---|
| When to use | Installing complex apps with many parameters | Per-environment customization |
| Main command | `helm install` / `helm upgrade` | `kubectl apply -k` |
| Rollback | `helm rollback` | `kubectl rollout undo` (Deployments) |

### Study checklist
- [ ] I know the difference between `kustomize build` and `kubectl apply -k`
- [ ] I know the minimal structure of a `kustomization.yaml`
- [ ] I can use Common Transformers (`labels`, `namespace`, `namePrefix`)
- [ ] I can use Image Transformers to change an image tag
- [ ] I can create ConfigMaps/Secrets with Generators
- [ ] I know the difference between Strategic Merge Patch and JSON 6902 patch
- [ ] I can create overlays for different environments (base + overlays)
- [ ] I can apply a specific overlay (`kubectl apply -k overlays/prod`)
- [ ] I can change replicas with the `replicas` field
- [ ] I can view the generated YAML without applying (`kubectl kustomize`)
- [ ] I can use a `kustomization.yaml` in subdirectories (referenced via `resources: - api/`)
