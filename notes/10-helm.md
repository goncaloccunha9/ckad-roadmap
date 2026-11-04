# Helm

> CKAD domain: Application Deployment (20%)

## Table of Contents
1. [What is Helm](#what-is-helm)
2. [Installation](#installation)
3. [Helm Concepts](#helm-concepts)
4. [Anatomy of a Helm Chart](#anatomy-of-a-helm-chart)
5. [Repositories](#repositories)
6. [Main Commands](#main-commands)
7. [Customizing Values](#customizing-values)
8. [Upgrade and Rollback](#upgrade-and-rollback)
9. [Common Exam Scenarios](#common-exam-scenarios)
10. [Quick Reference](#quick-reference)

> **Note on examples:** the examples use the public `podinfo` demo chart (`podinfo/podinfo`). The commands are the same for any chart repository. Chart versions shown are illustrative; list real ones with `helm search repo podinfo/podinfo --versions`.

---

## What is Helm

### The problem
Imagine deploying a WordPress application on Kubernetes - you need:
- Deployment
- Service
- PersistentVolume
- PersistentVolumeClaim
- Secret
- ConfigMap

That is **6+ YAML files**. And when you need a small change (e.g. a new image version), you have to:
1. Edit the file(s)
2. Apply them individually
3. Wait for everything to converge

### The solution: Helm
Helm is the **package manager for Kubernetes**. It treats a whole application as **a single unit** (a package).

**Analogy:** Think of Helm as a game installer - instead of manually installing the executable, sounds and textures, you install everything at once.

### Basic operations
```bash
helm install my-app <chart>     # Install everything at once
helm upgrade my-app <chart>     # Upgrade the whole app
helm rollback my-app            # Go back to the previous revision
helm uninstall my-app           # Remove everything
```

**EXAM TIP:** Helm manages the application as a **group**. A single operation affects multiple Kubernetes resources.

---

## Installation

```bash
# Linux (snap)
sudo snap install helm --classic

# macOS (brew)
brew install helm

# Check the version
helm version

# Show Helm's environment (paths, defaults)
helm env
```

**NOTE:** Installing Helm is not an exam topic - focus on using it.

### Helm 2 vs Helm 3+ (historical context)
- **Helm 2** had a server-side component called **Tiller** running inside the cluster. It is long obsolete.
- **Helm 3 and later (including Helm 4)** have no Tiller. The `helm` client talks directly to the Kubernetes API using your kubeconfig, and stores release state as Secrets in the release namespace.

All commands in these notes work with both Helm 3 and Helm 4.

---

## Helm Concepts

### Why use templates?
Instead of hard-coding values in the YAML files, we use **placeholders** that are filled in from a values file.

### Example: deployment.yaml as a template
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-wordpress
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}-wordpress
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}-wordpress
    spec:
      containers:
      - image: {{ .Values.image }}
        name: wordpress
        env:
        - name: WORDPRESS_PASSWORD
          value: {{ .Values.password }}
```

### values.yaml (the actual values)
```yaml
replicaCount: 3
image: wordpress:6.5-apache
password: my-secret-pass
storage: 20Gi
```

### When we install
Helm takes the templates + values, renders the final YAML and applies it to the cluster.

```
Templates + Values + Chart.yaml = Helm Chart
```

---

## Anatomy of a Helm Chart

A Helm chart is a directory with the following structure:

```
wordpress/
├── Chart.yaml          # Chart metadata (name, version, description)
├── values.yaml         # Default values
├── templates/          # Kubernetes resource templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── pvc.yaml
│   ├── secret.yaml
│   └── _helpers.tpl    # Helper functions
├── charts/             # Sub-charts (dependencies)
└── README.md
```

### Chart.yaml
```yaml
apiVersion: v2
name: wordpress
description: WordPress for Kubernetes
version: 1.0.0           # Chart version
appVersion: "6.5.0"      # Version of the application
```

### Key concepts

| Term | What it is |
|---|---|
| **Chart** | The package (templates + values + metadata) |
| **Release** | A specific installation of a chart in the cluster |
| **Repository** | A server that hosts multiple charts |
| **Values** | Settings that parameterize the chart |

**EXAM TIP:** You can install the **same chart multiple times** under different names (independent releases):
```bash
helm install release-1 podinfo/podinfo
helm install release-2 podinfo/podinfo
```

---

## Repositories

### Adding a repository
```bash
# Add a repo
helm repo add podinfo https://stefanprodan.github.io/podinfo

# List repos
helm repo list

# Refresh the local chart index
helm repo update

# Remove a repo
helm repo remove podinfo
```

### Searching for charts
```bash
# Search Artifact Hub (public)
helm search hub wordpress

# Search the repos you added locally
helm search repo podinfo
helm search repo podinfo/podinfo
helm search repo nginx
```

**EXAM TIP:** The difference:
- `helm search hub` → searches Artifact Hub (public web catalogue)
- `helm search repo` → searches only the repos you added locally (run `helm repo update` first for fresh results)

---

## Main Commands

### Install
```bash
# Syntax: helm install <release-name> <chart>
helm install my-release podinfo/podinfo

# Install from a local chart (directory)
helm install release-4 ./podinfo

# Pull a chart, then install from the local copy
helm pull --untar podinfo/podinfo
ls podinfo/
helm install my-release ./podinfo

# Pull a specific version
helm pull --untar podinfo/podinfo --version 6.15.0
helm install my-podinfo ./podinfo

# Install into a namespace
helm install my-release podinfo/podinfo --namespace prod --create-namespace

# Dry run (renders and validates, installs nothing)
helm install my-release podinfo/podinfo --dry-run

# Dry run with debug output
helm install my-release podinfo/podinfo --dry-run --debug
```

### List & status
```bash
helm list                       # Releases in the current namespace
helm list -A                    # Releases in all namespaces
helm list -n prod               # Releases in the prod namespace

helm status my-release          # Release status
helm get values my-release      # Show user-supplied values
helm get manifest my-release    # Show the full rendered YAML
helm get all my-release         # Show everything (manifest, values, hooks, notes)
```

### Uninstall
```bash
helm uninstall my-release
helm uninstall my-release -n prod
helm uninstall my-release --keep-history    # Keep the release history
```

---

## Customizing Values

### 3 ways to set values

**1. Default values** (from the chart's `values.yaml`)
```bash
helm install my-release podinfo/podinfo
```

**2. `--set` (inline, on the command line)**
```bash
helm install my-release podinfo/podinfo \
  --set replicaCount=3 \
  --set image.tag=6.15.0
```

**3. `--values` / `-f` (custom YAML file)**
```bash
# Create my-values.yaml
cat <<EOF > my-values.yaml
replicaCount: 3
image:
  tag: 6.15.0
EOF

helm install my-release podinfo/podinfo -f my-values.yaml
```

### Combining multiple `-f` files
```bash
helm install my-release podinfo/podinfo \
  -f base-values.yaml \
  -f prod-values.yaml \
  --set image.tag=6.15.0
```
**Precedence** (lowest to highest):
1. The chart's default `values.yaml`
2. `-f file.yaml` (later files override earlier ones)
3. `--set` (always wins)

**EXAM TIP:** For a simple change use `--set`; for several, use `-f values.yaml`. Memorise both.

### Inspecting available values
```bash
# Show the chart's default values.yaml
helm show values podinfo/podinfo

# Show Chart.yaml
helm show chart podinfo/podinfo

# Show the README
helm show readme podinfo/podinfo

# Show everything
helm show all podinfo/podinfo
```

---

## Upgrade and Rollback

### Upgrade
```bash
# Upgrade with new values
helm upgrade my-release podinfo/podinfo --set image.tag=6.16.0

# Upgrade with a values file
helm upgrade my-release podinfo/podinfo -f new-values.yaml

# Upgrade-or-install (installs if the release does not exist)
helm upgrade --install my-release podinfo/podinfo
```

**NOTE:** By default `helm upgrade` resets values to the chart defaults plus whatever you pass now. Use `--reuse-values` to keep the previous release's values, or pass the same `-f` file again.

### History (viewing revisions)
```bash
helm history my-release
```
Output (abridged):
```
REVISION  UPDATED                   STATUS      CHART           APP VERSION
1         Mon May 12 10:00:00 2026  superseded  podinfo-6.15.0  6.15.0
2         Mon May 12 11:00:00 2026  deployed    podinfo-6.16.0  6.16.0
```

### Rollback
```bash
# Roll back to the previous revision
helm rollback my-release

# Roll back to a specific revision
helm rollback my-release 1

# Rollback dry run
helm rollback my-release 1 --dry-run
```

**EXAM TIP:** Every `helm upgrade` creates a **new revision**, and so does a rollback. Rollback takes the revision number, not the chart version.

---

## Common Exam Scenarios

### 1. Add a repo and install a chart
```bash
helm repo add podinfo https://stefanprodan.github.io/podinfo
helm repo update
helm install my-podinfo podinfo/podinfo --version 6.15.0
```

### 2. Search for available versions
```bash
helm search repo podinfo/podinfo --versions
```

### 3. Pull a chart, customize it and install
```bash
helm pull --untar podinfo/podinfo
# Edit podinfo/values.yaml
helm install my-podinfo ./podinfo
```

### 4. List installed releases
```bash
helm list -A                    # All namespaces
helm list -n production         # A specific namespace
```

### 5. Upgrade the image version
```bash
helm upgrade my-release podinfo/podinfo --set image.tag=6.16.0
helm history my-release
```

### 6. Quick rollback
```bash
helm history my-release             # View revisions
helm rollback my-release 1          # Go back to revision 1
```

### 7. See the YAML Helm would apply (without applying)
```bash
helm install my-release podinfo/podinfo --dry-run --debug
helm template my-release podinfo/podinfo     # Only renders the YAML
```

### 8. Uninstall completely
```bash
helm uninstall my-release
helm list                       # Confirm
```

---

## Quick Reference

### Essential commands (MEMORISE!)

```bash
# === REPOSITORIES ===
helm repo add podinfo https://stefanprodan.github.io/podinfo
helm repo list
helm repo update
helm repo remove podinfo

# === SEARCH ===
helm search hub wordpress           # On Artifact Hub
helm search repo wordpress          # In local repos
helm search repo podinfo/podinfo --versions

# === CHART INFO ===
helm show chart podinfo/podinfo
helm show values podinfo/podinfo
helm show readme podinfo/podinfo
helm show all podinfo/podinfo

# === PULL ===
helm pull podinfo/podinfo
helm pull --untar podinfo/podinfo
helm pull --untar podinfo/podinfo --version 6.15.0

# === INSTALL ===
helm install RELEASE CHART
helm install my-release podinfo/podinfo
helm install my-release podinfo/podinfo --version 6.15.0
helm install my-release podinfo/podinfo -n prod --create-namespace
helm install my-release podinfo/podinfo --set image.tag=6.16.0
helm install my-release podinfo/podinfo -f my-values.yaml
helm install my-release ./local-chart           # Local chart
helm install my-release podinfo/podinfo --dry-run --debug

# === LIST & STATUS ===
helm list                           # Current namespace
helm list -A                        # All namespaces
helm list -n NAMESPACE
helm status RELEASE
helm get values RELEASE
helm get manifest RELEASE
helm get all RELEASE

# === UPGRADE ===
helm upgrade RELEASE CHART
helm upgrade my-release podinfo/podinfo --set image.tag=6.16.0
helm upgrade --install my-release podinfo/podinfo   # upgrade-or-install

# === HISTORY & ROLLBACK ===
helm history RELEASE
helm rollback RELEASE                # Previous revision
helm rollback RELEASE REVISION       # Specific revision
helm rollback my-release 1

# === UNINSTALL ===
helm uninstall RELEASE
helm uninstall my-release -n prod
helm uninstall my-release --keep-history

# === DEBUG ===
helm install ... --dry-run --debug
helm template RELEASE CHART          # Render YAML without installing
```

### Chart anatomy
```
my-chart/
├── Chart.yaml          # Metadata
├── values.yaml         # Default values
├── templates/          # YAML templates
│   ├── deployment.yaml
│   ├── service.yaml
│   └── _helpers.tpl
└── charts/             # Sub-charts (dependencies)
```

### Quick glossary

| Term | Definition |
|---|---|
| **Chart** | A Helm package (templates + values) |
| **Release** | A specific installation in the cluster |
| **Repository** | A place that hosts charts |
| **Revision** | A version of a release (increments on every upgrade or rollback) |
| **Values** | Parameters that customize the chart |
| **Templates** | YAML files with placeholders |

### Values precedence
1. The chart's `values.yaml` (defaults - lowest priority)
2. `-f custom-values.yaml` (in the order of the `-f` flags)
3. `--set key=value` (highest priority - always wins)

### Advanced `--set` syntax
```bash
# Simple value
--set replicaCount=3

# Nested value
--set image.tag=6.16.0

# Multiple values
--set replicaCount=3,image.tag=6.16.0

# Lists (quote the argument in zsh)
--set 'servers[0].port=80'

# Strings that must not be parsed as numbers/booleans
--set-string name="my-value"
```

### Study checklist
- [ ] I know what Helm is and why it is useful (the Kubernetes package manager)
- [ ] I know the difference between Chart, Release, Repository and Revision
- [ ] I can add and manage repositories
- [ ] I can search for charts (hub vs repo)
- [ ] I can install charts with `helm install`
- [ ] I can customize values with `--set` and `-f`
- [ ] I can upgrade and view history
- [ ] I can roll back (to a specific revision)
- [ ] I can uninstall
- [ ] I can use `--dry-run --debug` to see what would be applied
- [ ] I know the anatomy of a chart (Chart.yaml, values.yaml, templates/)
