# Drills — Services and Networking (20%)

Services, Ingress, NetworkPolicies, and fixing traffic that doesn't flow. Theory: [Services & Networking](../notes/07-network.md).

```bash
k create ns d4 && k config set-context --current --namespace=d4
k create deploy web --image=nginx:1.27 --replicas=2
k create deploy api --image=nginx:1.27
```

Test helper used throughout (a throwaway client Pod):

```bash
k run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 <service>:<port>
```

---

### 4.1 ClusterIP with port mapping · ⏱ 2 min · High yield

Expose Deployment `web` inside the cluster as Service `web-svc` on port `8080`, forwarding to container port `80`. Prove it works from another Pod.

<details><summary>Solution</summary>

```bash
k expose deploy web --name=web-svc --port=8080 --target-port=80
k get endpointslices -l kubernetes.io/service-name=web-svc     # 2 endpoints
k run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 web-svc:8080
```

From another namespace use `web-svc.d4` or `web-svc.d4.svc.cluster.local`.
</details>

### 4.2 NodePort on a fixed port · ⏱ 3 min

Expose `web` as Service `web-np` of type NodePort on node port `30080` (service port 80 → container port 80).

<details><summary>Solution</summary>

```bash
k expose deploy web --name=web-np --type=NodePort --port=80 --target-port=80 $do > np.yaml
# vim: under ports add  nodePort: 30080
k apply -f np.yaml
k get svc web-np          # 80:30080/TCP
```

Valid node ports are 30000–32767 by default.
</details>

### 4.3 Service with no endpoints · ⏱ 4 min · High yield

Apply the setup. Service `broken` doesn't answer. Find **both** problems and fix them without touching the Deployment.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 2
  selector:
    matchLabels: { app: backend }
  template:
    metadata:
      labels: { app: backend }
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: broken
spec:
  selector: { app: back-end }
  ports:
  - port: 80
    targetPort: 8080
```

<details><summary>Solution</summary>

```bash
k get endpointslices -l kubernetes.io/service-name=broken     # no endpoints → selector problem
k get pods --show-labels                                     # app=backend, not back-end
k patch svc broken -p '{"spec":{"selector":{"app":"backend"}}}'
k get endpointslices -l kubernetes.io/service-name=broken     # endpoints exist, but on port 8080
k patch svc broken --type=json -p '[{"op":"replace","path":"/spec/ports/0/targetPort","value":80}]'
k run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 broken
```

Debug in this order: endpoints empty → selector/labels (or Pods not Ready). Endpoints present but no answer → targetPort.
</details>

### 4.4 Ingress with host and path routing · ⏱ 4 min · High yield

Create Services `web` and `api` (port 80) for the Deployments. Create Ingress `shop` with IngressClass `nginx` for host `shop.example.com`: path `/api` (and everything below it) → `api:80`, everything else → `web:80`.

<details><summary>Solution</summary>

```bash
k expose deploy web --port=80
k expose deploy api --port=80
k create ingress shop --class=nginx \
  --rule="shop.example.com/api*=api:80" \
  --rule="shop.example.com/*=web:80"
k get ingress shop -o yaml | grep -B1 -A6 'path:'    # pathType: Prefix for both
```

The trailing `*` in `--rule` makes the path `Prefix`. Leave it out and you get `Exact`. With a controller running, test it with `curl -H 'Host: shop.example.com' http://<ingress-address>/api`.
</details>

### 4.5 TLS on the Ingress · ⏱ 4 min

Add TLS to Ingress `shop` for `shop.example.com`, using a Secret `shop-tls` made from a self-signed certificate.

<details><summary>Solution</summary>

```bash
openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt -subj "/CN=shop.example.com"
k create secret tls shop-tls --cert=tls.crt --key=tls.key
k edit ingress shop
```

```yaml
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - shop.example.com
    secretName: shop-tls
  rules: ...
```

The Secret must be in the same namespace as the Ingress.
</details>

### 4.6 Default deny · ⏱ 2 min · High yield

Block all incoming traffic to every Pod in `d4`. Prove that `web` no longer answers.

<details><summary>Solution</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes: ["Ingress"]
```

```bash
k apply -f deny.yaml
k run tmp --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 web    # times out
```

This drill needs a CNI that enforces NetworkPolicies. On a cluster without one, every policy is silently ignored.
</details>

### 4.7 Allow specific sources · ⏱ 5 min · High yield

With the default deny still in place: let Pods labelled `app=api` receive traffic on TCP 80 **only** from (a) Pods labelled `role=frontend` in `d4`, or (b) any Pod in namespaces labelled `team=ops`.

<details><summary>Solution</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow
spec:
  podSelector:
    matchLabels: { app: api }
  policyTypes: ["Ingress"]
  ingress:
  - from:
    - podSelector:                # (a)  ─┐ two list items = OR
        matchLabels: { role: frontend }
    - namespaceSelector:          # (b)  ─┘
        matchLabels: { team: ops }
    ports:
    - protocol: TCP
      port: 80
```

```bash
k run fe --rm -it --restart=Never --image=busybox:1.36 -l role=frontend -- wget -qO- -T 2 api   # works
k run x  --rm -it --restart=Never --image=busybox:1.36 -- wget -qO- -T 2 api                    # times out
```

The classic trap: putting `podSelector` and `namespaceSelector` in the **same** list item (no `-` before `namespaceSelector`) means AND, i.e. "Pods with that label *inside* namespaces with that label".
</details>

### 4.8 Lock down egress · ⏱ 5 min · High yield

Pods labelled `app=api` may only open connections to Pods labelled `app=db` on TCP 5432, plus DNS. Everything else outbound is blocked.

<details><summary>Solution</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-egress
spec:
  podSelector:
    matchLabels: { app: api }
  policyTypes: ["Egress"]
  egress:
  - to:
    - podSelector:
        matchLabels: { app: db }
    ports:
    - protocol: TCP
      port: 5432
  - ports:                        # DNS to anywhere
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

Forget the DNS rule and every lookup by name fails, even to `db`. It's an easy egress mistake to make.
</details>

---

Clean up: `k delete ns d4`
