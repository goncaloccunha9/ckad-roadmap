# Services & Networking

> CKAD domain: Services and Networking (20%)

## Table of Contents
1. [Traffic: Ingress vs Egress](#traffic-ingress-vs-egress)
2. [Network Security](#network-security)
3. [Network Policies](#network-policies)
4. [Network Policies - Advanced Rules](#network-policies---advanced-rules)
5. [Ingress](#ingress)
6. [Ingress Controller](#ingress-controller)
7. [Ingress Resources](#ingress-resources)
8. [Common Exam Scenarios](#common-exam-scenarios)
9. [Quick Reference](#quick-reference)

---

## Traffic: Ingress vs Egress

### Example Flow
```
User → (port 80) → Web Server → (port 5000) → API → (port 3306) → Database
```

### Definitions
- **Ingress** = traffic **entering** a system
- **Egress** = traffic **leaving** a system

### Each component's perspective

| Component | Ingress (incoming) | Egress (outgoing) |
|---|---|---|
| Web Server | User on port 80 | Talks to the API on port 5000 |
| API | Web Server on port 5000 | Talks to the DB on port 3306 |
| Database | API on port 3306 | Reply to the API |

**NOTE:** You only need to think about the direction in which the connection is initiated. Reply traffic for an allowed connection is allowed automatically (network policies are stateful). Remember that a connection between two pods needs both the source's Egress and the destination's Ingress to allow it, if both are restricted by policies.

---

## Network Security

### Default Behavior
By default, Kubernetes has an **"allow all"** behavior: all pods and services in the cluster can talk to each other (pods are "non-isolated").

- Every **Node** has an IP
- Every **Pod** has an IP
- Every **Service** has an IP

Every pod in the cluster can reach every other pod, which can raise security concerns. To restrict this, we use **Network Policies**.

---

## Network Policies

A Network Policy is a **Kubernetes object** (`kind: NetworkPolicy`) that controls network traffic to/from pods.

### Concept
- Associated with pods through **labels and selectors** (like Services and ReplicaSets)
- Once a NetworkPolicy selects a pod for a given direction (Ingress and/or Egress, as listed in `policyTypes`), **all traffic in that direction that is not explicitly allowed is blocked**
- Acts like a pod-level firewall
- Policies are **additive**: the allowed traffic is the union of all policies selecting the pod
- Enforcement requires a CNI plugin that supports NetworkPolicy (see the list in the Quick Reference); otherwise the objects are accepted but have no effect

### Basic Example: Allow Ingress from the API Pod to the DB Pod

**Label on the DB Pod:**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
  labels:
    role: db
spec:
  containers:
  - name: mysql
    image: mysql
    ports:
    - containerPort: 3306
```

**Network Policy:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
    ports:
    - protocol: TCP
      port: 3306
```

This says: the pod with label `role: db` only accepts **Ingress** traffic coming from pods with label `name: api-pod` (in the policy's own namespace) on port 3306. Its Egress is unaffected, because only `Ingress` is listed in `policyTypes`.

**EXAM TIP:** As soon as a NetworkPolicy selects a pod for a direction, all traffic in that direction that is not explicitly allowed by the rules is blocked.

---

## Network Policies - Advanced Rules

### Problem: Pods with the same labels in different namespaces
A `podSelector` on its own only matches pods in the policy's own namespace. If you also need to allow pods from another namespace (or want to restrict the namespace explicitly), add a `namespaceSelector`.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
      namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: prod
    ports:
    - protocol: TCP
      port: 3306
```

**NOTE:** If you keep only the `namespaceSelector` and omit the `podSelector`, **all** pods in the selected namespace get access.

### AND vs OR - The Most Important Rule!

The difference between AND and OR depends on **YAML indentation** (whether the selectors are in the same list element or in separate list elements).

**AND (same list element - a single `-`):**
```yaml
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
      namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: prod
```
Means: pods with label `api-pod` **AND** in the `prod` namespace (both conditions required).

**OR (separate list elements - two `-`):**
```yaml
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: prod
```
Means: pods with label `api-pod` **OR** any pod in the `prod` namespace.

**EXAM TIP:** AND vs OR is a classic source of mistakes. The difference is literally one extra `-` in the YAML. Be extra careful with indentation!

### ipBlock - Traffic from outside the cluster
To allow traffic from a server outside the cluster (e.g. a Backup Server):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
      namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: prod
    - ipBlock:
        cidr: 192.168.5.10/32
    ports:
    - protocol: TCP
      port: 3306
```

Means: accepts traffic from (api-pod AND namespace prod) **OR** from IP 192.168.5.10.

### Egress - Outgoing traffic
To allow the DB Pod to send data to the Backup Server:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
    ports:
    - protocol: TCP
      port: 3306
  egress:
  - to:
    - ipBlock:
        cidr: 192.168.5.10/32
    ports:
    - protocol: TCP
      port: 80
```

### Allowing DNS (Egress)
When you restrict Egress, pods also lose access to the cluster DNS. To fix this:

```yaml
  egress:
  - to:
    - ipBlock:
        cidr: 192.168.5.10/32
    ports:
    - protocol: TCP
      port: 80
  - ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

**EXAM TIP:** If you apply an Egress policy and pods can no longer resolve names (DNS), add an Egress rule for port 53 (UDP and TCP).

### Blocking all traffic (deny all)

**Deny all Ingress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

**Deny all Egress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-egress
spec:
  podSelector: {}
  policyTypes:
  - Egress
```

**Deny all (Ingress + Egress):**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

**NOTE:** `podSelector: {}` selects **all** pods in the policy's namespace.

---

## Ingress

### What is it?
Ingress manages external HTTP/HTTPS access to services inside the cluster. It acts as a "smart router" with:
- Routing by **URL path** (`/wear`, `/watch`)
- Routing by **hostname** (`wear.example.com`, `watch.example.com`)
- SSL/TLS termination
- Load balancing

**NOTE:** The Ingress resource does nothing on its own: a cluster needs an **Ingress Controller** installed (e.g. NGINX, Traefik, HAProxy, Contour). The Kubernetes project now marks the Ingress API as frozen (stable, but no new features) and recommends the Gateway API for new work; the Ingress API is not being removed. Note that the community `ingress-nginx` controller was announced as retired in March 2026, so prefer another controller in real clusters.

### Two Components
1. **Ingress Controller** - The deployment that processes the rules (e.g. NGINX)
2. **Ingress Resource** - The routing rules (what we configure)

---

## Ingress Controller

Illustrative example of the pieces that make up an NGINX Ingress Controller. In practice a controller is installed with its official manifests or Helm chart (which also include the RBAC rules missing here), or comes pre-installed.

### 1. Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-ingress-controller
spec:
  replicas: 1
  selector:
    matchLabels:
      name: nginx-ingress
  template:
    metadata:
      labels:
        name: nginx-ingress
    spec:
      containers:
      - name: nginx-ingress-controller
        image: registry.k8s.io/ingress-nginx/controller:<version>   # illustrative; use your controller's image
        args:
        - /nginx-ingress-controller
        - --configmap=$(POD_NAMESPACE)/nginx-configuration
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        ports:
        - name: http
          containerPort: 80
        - name: https
          containerPort: 443
```

### 2. ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-configuration
```

### 3. Service (exposes the controller)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-ingress
spec:
  type: NodePort
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  - port: 443
    targetPort: 443
    protocol: TCP
    name: https
  selector:
    name: nginx-ingress
```

### 4. ServiceAccount
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nginx-ingress-serviceaccount
```

### 5. IngressClass
An Ingress selects its controller through `spec.ingressClassName`, which refers to an `IngressClass` object. If it is omitted, the cluster's default IngressClass (if any) is used.
```bash
kubectl get ingressclass
```

**NOTE:** The `kubernetes.io/ingress.class` annotation is deprecated; use `ingressClassName`.

---

## Ingress Resources

### 1. Simple Backend (a single service)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-wear
spec:
  defaultBackend:
    service:
      name: wear-service
      port:
        number: 80
```

### 2. Path-based Routing
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-wear-watch
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx          # must match an existing IngressClass
  rules:
  - http:
      paths:
      - path: /wear
        pathType: Prefix
        backend:
          service:
            name: wear-service
            port:
              number: 80
      - path: /watch
        pathType: Prefix
        backend:
          service:
            name: watch-service
            port:
              number: 80
```

### 3. Hostname-based Routing (Domain)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-wear-watch
spec:
  ingressClassName: nginx          # must match an existing IngressClass
  rules:
  - host: wear.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wear-service
            port:
              number: 80
  - host: watch.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: watch-service
            port:
              number: 80
```

### pathType
`pathType` is **required** for every path in `networking.k8s.io/v1`.
- `Prefix` - matches by path prefix, element by element split on `/` (e.g. `/wear` matches `/wear` and `/wear/x`, not `/wearing`)
- `Exact` - matches the exact path only
- `ImplementationSpecific` - matching is up to the IngressClass/controller

### rewrite-target annotation
When the path in the Ingress is `/wear` but the application expects `/` (this annotation is specific to the NGINX ingress controller):
```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
```
Without it: request to `/wear` → application receives `/wear` (may return 404)
With it: request to `/wear` → application receives `/` (correct)

For sub-paths (e.g. `/wear/shoes` → `/shoes`) use a regex path with a capture group: `path: /wear(/|$)(.*)`, `pathType: ImplementationSpecific`, and `rewrite-target: /$2`.

**EXAM TIP:** `rewrite-target` is common in Ingress tasks. If the app returns 404 through the Ingress, this annotation may be missing.

### Ingress Commands
```bash
# Create (imperative); a trailing * makes the path type Prefix, otherwise Exact
kubectl create ingress ingress-test --rule="wear.example.com/wear*=wear-service:80"

# Create with multiple rules
kubectl create ingress ingress-test \
  --rule="wear.example.com/wear*=wear-service:80" \
  --rule="watch.example.com/watch*=watch-service:80"

# Set the IngressClass
kubectl create ingress ingress-test --class=nginx --rule="/wear*=wear-service:80"

# View ingress
kubectl get ingress
kubectl get ingress -A                  # all namespaces
kubectl describe ingress ingress-wear-watch

# Create from a file
kubectl create -f ingress-definition.yaml
```

---

## Common Exam Scenarios

### 1. Create a NetworkPolicy that allows Ingress only from a specific pod
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-only
  namespace: default
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
    ports:
    - protocol: TCP
      port: 3306
```

### 2. Deny all Ingress in a namespace
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

### 3. Create an Ingress with path-based routing
```bash
# The trailing * creates a Prefix path; without it the path type is Exact
kubectl create ingress myingress \
  --rule="/wear*=wear-service:80" \
  --rule="/watch*=watch-service:80"
```

### 4. Troubleshoot an Ingress that does not work
```bash
kubectl describe ingress myingress         # Check rules and backends
kubectl get svc                             # Check that the services exist
kubectl get endpointslices                  # Check that endpoints have IPs (kubectl get endpoints is deprecated since v1.33)
kubectl get pods -l app=myapp               # Check that the pods are running
```

### 5. NetworkPolicy with Egress + DNS
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: egress-with-dns
spec:
  podSelector:
    matchLabels:
      role: api
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          role: db
    ports:
    - protocol: TCP
      port: 3306
  - ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

---

## Quick Reference

### Essential Commands
```bash
# k = alias for kubectl
# === NETWORK POLICIES ===
k get networkpolicies                    # or k get netpol
k describe networkpolicy db-policy
k get netpol -n namespace
k create -f netpol.yaml

# === INGRESS ===
k get ingress                            # or k get ing
k describe ingress ingress-name
k create ingress name --rule="host/path*=svc:port"
k create ingress name --rule="host/path*=svc:port" --dry-run=client -o yaml > ing.yaml

# === DEBUG NETWORKING ===
k get svc
k get endpointslices                     # (kubectl get endpoints is deprecated since v1.33)
k describe svc service-name
k get pods -o wide                       # Show pod IPs
```

### NetworkPolicy Template (Ingress + Egress)
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          name: api-pod
      namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: prod
    ports:
    - protocol: TCP
      port: 3306
  egress:
  - to:
    - ipBlock:
        cidr: 192.168.5.10/32
    ports:
    - protocol: TCP
      port: 80
  - ports:
    - protocol: UDP
      port: 53
```

### Ingress Resource Template
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx          # must match an existing IngressClass
  rules:
  - host: mysite.example.com
    http:
      paths:
      - path: /app1
        pathType: Prefix
        backend:
          service:
            name: app1-service
            port:
              number: 80
      - path: /app2
        pathType: Prefix
        backend:
          service:
            name: app2-service
            port:
              number: 80
```

### AND vs OR Cheat Sheet
```yaml
# AND (a single -, selectors in the same block)
- podSelector:
    matchLabels:
      name: api-pod
  namespaceSelector:
    matchLabels:
      kubernetes.io/metadata.name: prod

# OR (two -, selectors in separate blocks)
- podSelector:
    matchLabels:
      name: api-pod
- namespaceSelector:
    matchLabels:
      kubernetes.io/metadata.name: prod
```

### CNI Plugins That Enforce NetworkPolicy
- Calico
- Cilium
- Antrea
- Kube-router

**NOTE:** Flannel on its own does NOT support NetworkPolicies.

### Study Checklist
- [ ] I know the difference between Ingress and Egress
- [ ] I can create NetworkPolicies for Ingress and Egress
- [ ] I know the difference between AND and OR in NetworkPolicies (indentation!)
- [ ] I can use podSelector, namespaceSelector and ipBlock
- [ ] I know DNS (port 53) must be allowed in Egress policies
- [ ] I can create Ingress resources with path-based and hostname-based routing
- [ ] I can use pathType (Prefix, Exact) and ingressClassName
- [ ] I can use the rewrite-target annotation
- [ ] I can create an Ingress with the imperative command
- [ ] I know that Flannel on its own does not support NetworkPolicies
