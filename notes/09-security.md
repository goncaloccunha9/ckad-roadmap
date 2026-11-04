# Security

> CKAD domain: Application Environment, Configuration and Security (25%)

## Table of Contents
1. [Security Primitives](#security-primitives)
2. [Authentication](#authentication)
3. [Kubeconfig](#kubeconfig)
4. [API Groups](#api-groups)
5. [Authorization](#authorization)
6. [RBAC - Roles & RoleBindings](#rbac---roles--rolebindings)
7. [ClusterRoles & ClusterRoleBindings](#clusterroles--clusterrolebindings)
8. [ServiceAccounts](#serviceaccounts)
9. [Admission Controllers](#admission-controllers)
10. [API Versions & Deprecations](#api-versions--deprecations)
11. [Custom Resource Definitions](#custom-resource-definitions)
12. [Common Exam Scenarios](#common-exam-scenarios)
13. [Quick Reference](#quick-reference)

---

## Security Primitives

### First line of defence: kube-apiserver
All communication with the cluster goes through the kube-apiserver (including `kubectl`).

### Who can access the cluster? (Authentication)
- Static token file
- X.509 client certificates
- External identity providers (OpenID Connect, LDAP via a webhook/proxy)
- ServiceAccounts

### What can they do? (Authorization)
- **RBAC** (Role-Based Access Control) - by far the most common
- **Node authorization**
- **ABAC** (Attribute-Based Access Control)
- **Webhook mode**

### Internal communication
All communication between cluster components (kubelet, kube-proxy, scheduler, controller-manager, etcd, apiserver) is secured with **TLS certificates**.

**EXAM TIP:** For CKAD, the main focus is **RBAC**, **ServiceAccounts** and **SecurityContexts**. The other mechanisms are mostly CKA material.

---

## Authentication

### Types of users in a cluster
- **Users:** admins, developers
- **ServiceAccounts:** bots, third-party integrations, Pods

**Important:** Kubernetes does **NOT manage users** natively - there is no `kind: User` object. Users come from external sources (certificates, tokens, an identity provider). Kubernetes **does manage ServiceAccounts** (they exist as API objects).

### Accessing the cluster
```bash
kubectl ...                                           # Via kubectl
curl https://kube-server-ip:6443/api/v1/pods         # Directly via the API (needs credentials)
```

### Authentication mechanisms

| Mechanism | Description | Use |
|---|---|---|
| **Static token file** | CSV file with tokens | Dev/learning only |
| **Static password file / basic auth** | CSV file with passwords (removed in 1.19) | Not available |
| **Certificates** | x509 client certificates | Production |
| **ServiceAccounts** | For workloads inside the cluster | Production |
| **OpenID Connect / webhook** | External identity providers | Enterprise |

**NOTE:** The static token file is not recommended for production. It is mainly useful for learning.

---

## Kubeconfig

### What is it?
A file (default `$HOME/.kube/config`) holding cluster endpoints, credentials and contexts - so you don't have to specify credentials on every `kubectl` command.

### Structure: 3 main sections
1. **Clusters** - cluster addresses (dev, prod, etc.)
2. **Contexts** - user + cluster (+ optional namespace) combinations
3. **Users** - user credentials

### Example
```yaml
apiVersion: v1
kind: Config
current-context: my-kube-admin@my-kube-playground
clusters:
- name: my-kube-playground
  cluster:
    certificate-authority: /etc/kubernetes/pki/ca.crt
    server: https://my-kube-playground:6443
contexts:
- name: my-kube-admin@my-kube-playground
  context:
    cluster: my-kube-playground
    user: my-kube-admin
    namespace: finance
users:
- name: my-kube-admin
  user:
    client-certificate: /etc/kubernetes/pki/admin.crt
    client-key: /etc/kubernetes/pki/admin.key
```

### Essential commands
```bash
kubectl config view                                  # Show current config
kubectl config get-contexts                          # List contexts
kubectl config current-context                       # Current context
kubectl config use-context prod-user@production      # Switch context
kubectl config set-context --current --namespace=dev # Change the namespace of the current context
kubectl config --kubeconfig=/path/to/config use-context xyz
```

### Using a different kubeconfig
```bash
export KUBECONFIG=/root/my-kube-config
# Or
kubectl --kubeconfig=/path/to/config get pods
```

**EXAM TIP:** Use **absolute paths** (e.g. `/etc/kubernetes/pki/ca.crt`) instead of relative paths in a kubeconfig. It is less error-prone.

---

## API Groups

### API structure
```
/api          → Core group (v1)
  - pods, services, configmaps, secrets, namespaces, nodes, PV, PVC

/apis         → Named groups
  - apps/v1                    → deployments, replicasets, statefulsets
  - batch/v1                   → jobs, cronjobs
  - networking.k8s.io/v1       → networkpolicies, ingresses
  - rbac.authorization.k8s.io/v1 → roles, rolebindings
  - storage.k8s.io/v1          → storageclasses
```

### Commands
```bash
kubectl api-resources                       # List all resource types
kubectl api-resources --namespaced=true     # Namespaced only
kubectl api-resources --namespaced=false    # Cluster-scoped only
kubectl api-versions                        # List API versions
```

### Accessing the API directly
```bash
# Check the version
curl https://kube-master:6443/version

# List groups (with client certs)
curl https://localhost:6443 -k \
  --key admin.key --cert admin.crt

# Easier: use kubectl proxy
kubectl proxy                                # Default port 8001
curl http://localhost:8001 -k                # No certs needed
```

**NOTE:** `kubectl proxy` ≠ `kube-proxy`
- `kubectl proxy` → a local CLI proxy to the API server that uses your stored credentials
- `kube-proxy` → a cluster component that implements Service networking on each node

---

## Authorization

### Authorization modes

| Mode | Description |
|---|---|
| **Node** | Authorizes requests made by kubelets |
| **ABAC** | Attribute-based - policies in manually maintained JSON files |
| **RBAC** | **Role-based - the most widely used and the focus for CKAD** |
| **Webhook** | Delegate authorization to an external service |
| **AlwaysAllow** | No checks (never use in production!) |
| **AlwaysDeny** | Denies everything |

### Configuring the kube-apiserver
```
--authorization-mode=Node,RBAC,Webhook
```
Multiple modes are checked in the order listed; the first one that allows or denies the request decides.

---

## RBAC - Roles & RoleBindings

### Role (namespace-scoped)
Defines **what** can be done.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: developer
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["list", "get", "create", "update", "delete"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["create"]
```

### Parts of a rule

| Field | Example | Description |
|---|---|---|
| `apiGroups` | `[""]` (core) or `["apps"]` | API group |
| `resources` | `["pods", "services"]` | Resources covered |
| `verbs` | `["get", "list", "create", "update", "delete", "watch"]` | Allowed operations |
| `resourceNames` | `["blue", "orange"]` (optional) | Restrict to specific named resources |

**EXAM TIP:** `apiGroups: [""]` (empty string) refers to the **core group** (pods, services, configmaps, secrets, etc.). For Deployments use `["apps"]`.

### Restricting to specific resources
```yaml
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "update"]
  resourceNames: ["blue", "orange"]
```
Only allows operating on the pods named `blue` and `orange`.

### RoleBinding (binds a Role to a subject)
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devuser-developer-binding
  namespace: default
subjects:
- kind: User
  name: dev-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

### Imperative commands (CRITICAL FOR THE EXAM)
```bash
# Create a Role
kubectl create role developer \
  --verb=get,list,create,update,delete \
  --resource=pods,configmaps

# Create a Role with resourceNames
kubectl create role pod-reader \
  --verb=get,list \
  --resource=pods \
  --resource-name=blue --resource-name=orange

# Create a RoleBinding for a user
kubectl create rolebinding dev-binding \
  --role=developer \
  --user=dev-user

# Create a RoleBinding for a ServiceAccount
kubectl create rolebinding dev-binding \
  --role=developer \
  --serviceaccount=default:my-sa
```

### Checking permissions - `kubectl auth can-i`
```bash
# Check YOUR permissions
kubectl auth can-i create deployments
kubectl auth can-i delete nodes

# Check ANOTHER user's permissions (admin only)
kubectl auth can-i create deployments --as dev-user
kubectl auth can-i delete pods --as dev-user --namespace test

# List all permissions in a namespace
kubectl auth can-i --list --namespace=default
```

**EXAM TIP:** `kubectl auth can-i` is your best friend for validating RBAC.

### Query commands
```bash
kubectl get roles
kubectl get roles -n kube-system
kubectl get roles --all-namespaces
kubectl get rolebindings
kubectl describe role developer
kubectl describe rolebinding devuser-developer-binding
```

---

## ClusterRoles & ClusterRoleBindings

### Difference vs Role/RoleBinding

| | Role / RoleBinding | ClusterRole / ClusterRoleBinding |
|---|---|---|
| Scope | Namespace | **Entire cluster** |
| Can grant access to | Namespaced resources | **Cluster-scoped + namespaced resources** |
| Typical resources | pods, services, configmaps | nodes, PVs, namespaces, clusterroles |

### Namespaced vs cluster-scoped resources

**Namespaced:**
- pods, services, deployments, replicasets
- configmaps, secrets, serviceaccounts
- jobs, cronjobs, pvc
- roles, rolebindings

**Cluster-scoped (no namespace):**
- nodes, namespaces, persistentvolumes
- clusterroles, clusterrolebindings
- storageclasses
- customresourcedefinitions

### Listing resources by scope
```bash
kubectl api-resources --namespaced=true     # Namespaced
kubectl api-resources --namespaced=false    # Cluster-scoped
kubectl get clusterroles | wc -l            # Count clusterroles
```

### ClusterRole
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-administrator
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["list", "get", "create", "delete"]
```

### ClusterRoleBinding
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cluster-admin-role-binding
subjects:
- kind: User
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-administrator
  apiGroup: rbac.authorization.k8s.io
```

### Imperative commands
```bash
# Create a ClusterRole
kubectl create clusterrole node-reader \
  --verb=get,list,watch \
  --resource=nodes

# Create a ClusterRoleBinding
kubectl create clusterrolebinding node-reader-binding \
  --clusterrole=node-reader \
  --user=admin-user

# ClusterRoleBinding for a ServiceAccount
kubectl create clusterrolebinding sa-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=default:my-sa
```

**EXAM TIP:** You can also use ClusterRoles **for namespaced resources** - when bound through a RoleBinding, the permissions apply only within the RoleBinding's namespace. This is useful for reusing a ClusterRole across namespaces.

---

## ServiceAccounts

A ServiceAccount is the identity a Pod uses when it talks to the API server. Every namespace has a `default` ServiceAccount.

```bash
kubectl create serviceaccount my-sa
kubectl get serviceaccounts

# Request a short-lived token for a ServiceAccount (Kubernetes 1.24+)
kubectl create token my-sa
kubectl create token my-sa --duration=1h
```

### Using a ServiceAccount in a Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  serviceAccountName: my-sa
  automountServiceAccountToken: true   # Set to false if the Pod never calls the API
  containers:
  - name: app
    image: nginx
```

**NOTE:** Since Kubernetes 1.24, creating a ServiceAccount does **not** auto-create a token Secret. Pods receive a short-lived, automatically rotated token projected into the container (`/var/run/secrets/kubernetes.io/serviceaccount/`). Use `kubectl create token` when you need a token manually. A long-lived token requires explicitly creating a Secret of type `kubernetes.io/service-account-token` annotated with `kubernetes.io/service-account.name` (not recommended).

---

## Admission Controllers

### Where do they fit?
```
kubectl → Authentication → Authorization → Admission Controllers → etcd
```

### What do they do?
They validate or modify requests **before** the object is persisted to etcd. Examples:
- Enforce Pod Security Standards (e.g. reject privileged Pods)
- Auto-create namespaces
- Set the default StorageClass on PVCs
- Reject objects in a namespace that does not exist

> **Note:** PodSecurityPolicy was removed in Kubernetes 1.25. Its replacement is the built-in **Pod Security Admission** (the `PodSecurity` controller, enabled by default), configured with namespace labels such as `pod-security.kubernetes.io/enforce=restricted`.

### Common admission controllers

| Controller | What it does |
|---|---|
| `AlwaysPullImages` | Forces image pulls on every Pod start (not default) |
| `DefaultStorageClass` | Assigns the default StorageClass to PVCs (default) |
| `NamespaceLifecycle` | Rejects objects in non-existent or terminating namespaces (default) |
| `NamespaceExists` | Rejects requests for non-existent namespaces (not default) |
| `NamespaceAutoProvision` | Creates missing namespaces automatically (not default!) |
| `PodSecurity` | Enforces Pod Security Standards (default) |
| `EventRateLimit` | Limits the rate of events (not default) |
| `NodeRestriction` | Limits what a kubelet may modify |
| `LimitRanger` | Applies LimitRange defaults and limits (default) |
| `ResourceQuota` | Enforces ResourceQuotas (default) |
| `ServiceAccount` | Automates ServiceAccount handling for Pods (default) |

### Listing the active admission controllers
```bash
kube-apiserver -h | grep enable-admission-plugins

# In a kubeadm cluster:
kubectl exec kube-apiserver-controlplane -n kube-system -- \
  kube-apiserver -h | grep enable-admission-plugins
```

### Enabling / disabling
Edit `/etc/kubernetes/manifests/kube-apiserver.yaml` (static Pod) and change the command-line flags:
```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --enable-admission-plugins=NodeRestriction,NamespaceAutoProvision
    - --disable-admission-plugins=DefaultStorageClass
    # ...other flags unchanged
```

### Mutating vs Validating

| Type | What it does | Example |
|---|---|---|
| **Mutating** | Modifies the request before it is stored | `DefaultStorageClass` (adds a storageClassName) |
| **Validating** | Validates the request, accepts or rejects it | `NamespaceExists` |

**Order:** Mutating controllers run **first**, then Validating ones.

### Webhooks (custom admission controllers)
Allow external admission controllers via `MutatingWebhookConfiguration` / `ValidatingWebhookConfiguration`. Newer, in-cluster alternatives that need no webhook server are `ValidatingAdmissionPolicy` and `MutatingAdmissionPolicy` (CEL-based).

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: pod-policy.example.com
webhooks:
- name: pod-policy.example.com
  admissionReviewVersions: ["v1"]
  sideEffects: None
  clientConfig:
    service:
      namespace: webhook-namespace
      name: webhook-service
    caBundle: "Ci0tLS0tkQk..."
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE"]
    resources: ["pods"]
    scope: "Namespaced"
```

**For CKAD:** Knowing that Mutating and Validating controllers exist is enough. You do not need to build webhooks from scratch.

---

## API Versions & Deprecations

### Version levels
```
v1                          → GA (stable)
v1beta1, v1beta2, ...       → Beta (may change)
v1alpha1                    → Alpha (experimental)
```

### Multiple versions
A resource can exist in several versions - but only **one is the storage version** (the one persisted to etcd).

To enable an alpha/beta API on the apiserver:
```
--runtime-config=rbac.authorization.k8s.io/v1alpha1
```

### Kubernetes version convention
`X.Y.Z` (e.g. `1.37.1`)
- **X** → Major
- **Y** → Minor (a new minor release roughly every 4 months)
- **Z** → Patch

### `kubectl convert`
Migrates a manifest from an old API version to a newer one:
```bash
kubectl convert -f nginx-old.yaml --output-version apps/v1 > nginx-new.yaml
kubectl convert -f nginx-old.yaml --output-version apps/v1 | kubectl apply -f -
```

**NOTE:** `kubectl convert` is a separate plugin that must be installed. It is not included with kubectl by default.

**EXAM TIP:** To find the current API version of a resource:
```bash
kubectl explain deployment | head -3
kubectl api-resources | grep deployment
```

---

## Custom Resource Definitions

### Concept
CRDs let you define **custom Kubernetes objects**, served by the same API as built-in resources (pods, deployments).

### Example: a FlightTicket CRD
```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: flighttickets.flights.com
spec:
  scope: Namespaced
  group: flights.com
  names:
    kind: FlightTicket
    singular: flightticket
    plural: flighttickets
    shortNames:
    - ft
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
            properties:
              from:
                type: string
              to:
                type: string
              number:
                type: integer
                minimum: 1
                maximum: 10
```

### Using the custom resource
```yaml
apiVersion: flights.com/v1
kind: FlightTicket
metadata:
  name: my-flight-ticket
spec:
  from: Mumbai
  to: London
  number: 2
```

```bash
kubectl apply -f flightticket-crd.yaml      # Create the CRD
kubectl apply -f flightticket.yaml          # Create the resource
kubectl get flighttickets                   # List
kubectl get ft                              # Using the short name
```

### Custom controllers
- Code that watches the custom resource through the API server
- Reacts by creating/deleting resources, including external ones (e.g. calling a booking API)
- Usually written in Go, using `sample-controller` or `kubebuilder` as a starting point

### Operators
An Operator packages a CRD together with a custom controller.
Ready-made operators: https://operatorhub.io/

**EXAM TIP:** For CKAD, knowing **how to create and use** CRDs is enough. You do not need to write controllers from scratch.

---

## Common Exam Scenarios

### 1. Create a Role + RoleBinding for a user
```bash
# Role
kubectl create role pod-reader \
  --verb=get,list,watch \
  --resource=pods

# RoleBinding
kubectl create rolebinding pod-reader-binding \
  --role=pod-reader \
  --user=dev-user

# Test
kubectl auth can-i get pods --as dev-user
```

### 2. Create a Role for a ServiceAccount
```bash
# Create the ServiceAccount
kubectl create serviceaccount my-sa

# Create the Role
kubectl create role configmap-reader \
  --verb=get,list \
  --resource=configmaps

# Bind to the ServiceAccount (namespace:sa-name notation)
kubectl create rolebinding cm-reader-binding \
  --role=configmap-reader \
  --serviceaccount=default:my-sa

# Test
kubectl auth can-i get configmaps --as system:serviceaccount:default:my-sa
```

### 3. ClusterRole for accessing nodes
```bash
kubectl create clusterrole node-admin \
  --verb=get,list,create,delete \
  --resource=nodes

kubectl create clusterrolebinding node-admin-binding \
  --clusterrole=node-admin \
  --user=cluster-admin
```

### 4. Switch kubectl context
```bash
kubectl config get-contexts                       # List
kubectl config use-context prod-cluster           # Switch
kubectl config set-context --current --namespace=dev  # Change namespace
```

### 5. List cluster-scoped resources
```bash
kubectl api-resources --namespaced=false
```

### 6. Troubleshoot an RBAC problem
```bash
kubectl auth can-i create pods --as dev-user
kubectl auth can-i --list --as dev-user
kubectl describe role developer
kubectl describe rolebinding developer-binding
```

---

## Quick Reference

### Imperative RBAC commands (MEMORISE!)

```bash
# === ROLES ===
k create role NAME --verb=get,list,create --resource=pods,configmaps
k create role NAME --verb=get --resource=pods --resource-name=specific-pod

# === ROLEBINDINGS ===
k create rolebinding NAME --role=ROLE --user=USER
k create rolebinding NAME --role=ROLE --serviceaccount=NS:SA
k create rolebinding NAME --role=ROLE --group=GROUP

# === CLUSTERROLES ===
k create clusterrole NAME --verb=get,list --resource=nodes,persistentvolumes

# === CLUSTERROLEBINDINGS ===
k create clusterrolebinding NAME --clusterrole=CR --user=USER
k create clusterrolebinding NAME --clusterrole=CR --serviceaccount=NS:SA

# === SERVICEACCOUNTS ===
k create serviceaccount NAME
k create token NAME

# === CHECK PERMISSIONS ===
k auth can-i VERB RESOURCE
k auth can-i VERB RESOURCE --as USER
k auth can-i VERB RESOURCE --as USER --namespace NS
k auth can-i --list                       # All my permissions
k auth can-i --list --as USER

# === QUERY ===
k get roles
k get rolebindings
k get clusterroles
k get clusterrolebindings
k describe role NAME
k describe rolebinding NAME

# === CONFIG ===
k config view
k config get-contexts
k config current-context
k config use-context CTX
k config set-context --current --namespace=NS

# === API ===
k api-resources
k api-resources --namespaced=true
k api-resources --namespaced=false
k api-versions
```

### Role template
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: my-role
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "create", "update", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

### RoleBinding template
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: my-binding
  namespace: default
subjects:
- kind: User
  name: dev-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: my-role
  apiGroup: rbac.authorization.k8s.io
```

### ClusterRole template
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-cluster-role
rules:
- apiGroups: [""]
  resources: ["nodes", "persistentvolumes"]
  verbs: ["get", "list", "watch"]
```

### ClusterRoleBinding template
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: my-cluster-binding
subjects:
- kind: User
  name: admin-user
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: my-cluster-role
  apiGroup: rbac.authorization.k8s.io
```

### apiGroups cheat sheet

| apiGroup | Resources |
|---|---|
| `""` (core) | pods, services, configmaps, secrets, namespaces, nodes, persistentvolumes, persistentvolumeclaims, serviceaccounts |
| `apps` | deployments, replicasets, statefulsets, daemonsets |
| `batch` | jobs, cronjobs |
| `networking.k8s.io` | networkpolicies, ingresses |
| `rbac.authorization.k8s.io` | roles, rolebindings, clusterroles, clusterrolebindings |
| `storage.k8s.io` | storageclasses |

### RBAC verbs

| Verb | Operation |
|---|---|
| `get` | Read a single resource |
| `list` | List all resources |
| `watch` | Stream changes |
| `create` | Create |
| `update` | Update |
| `patch` | Partial update |
| `delete` | Delete |
| `deletecollection` | Delete several at once |
| `*` | Everything |

### Subjects cheat sheet

```yaml
# User
subjects:
- kind: User
  name: dev-user
  apiGroup: rbac.authorization.k8s.io

# Group
subjects:
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io

# ServiceAccount
subjects:
- kind: ServiceAccount
  name: my-sa
  namespace: default
```

### Study checklist
- [ ] I know the difference between Users (external) and ServiceAccounts (in-cluster)
- [ ] I know what a kubeconfig is and how to switch context/namespace
- [ ] I know the difference between Authentication and Authorization
- [ ] I know the main Authorization modes (Node, ABAC, RBAC, Webhook)
- [ ] I can create Roles and RoleBindings imperatively
- [ ] I can create ClusterRoles and ClusterRoleBindings imperatively
- [ ] I can use `kubectl auth can-i` to validate permissions
- [ ] I can create a ServiceAccount, assign it to a Pod and request a token
- [ ] I know the difference between namespaced and cluster-scoped resources
- [ ] I can use `kubectl api-resources --namespaced=true/false`
- [ ] I know the most common apiGroups (core, apps, batch, networking, rbac)
- [ ] I know what Admission Controllers are (Mutating vs Validating)
- [ ] I know what CRDs are and how to create a custom resource
- [ ] I know the Kubernetes version convention (Major.Minor.Patch)
