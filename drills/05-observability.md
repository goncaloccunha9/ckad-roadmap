# Drills — Application Observability and Maintenance (15%)

Probes, logs, debugging, monitoring, API deprecations. Theory: [observability](../notes/05-observability.md).

```bash
k create ns d5 && k config set-context --current --namespace=d5
```

---

### 5.1 All three probes · ⏱ 5 min · High yield

Deployment `probed` (`nginx:1.27`, 2 replicas):
- **startup**: HTTP GET `/` on port 80, checked every 5s, up to 12 failures (1 minute to start)
- **liveness**: TCP on port 80 every 10s
- **readiness**: exec `cat /usr/share/nginx/html/index.html` every 5s, starting after 3s

<details><summary>Solution</summary>

```yaml
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
        startupProbe:
          httpGet: { path: /, port: 80 }
          periodSeconds: 5
          failureThreshold: 12
        livenessProbe:
          tcpSocket: { port: 80 }
          periodSeconds: 10
        readinessProbe:
          exec:
            command: ["cat", "/usr/share/nginx/html/index.html"]
          initialDelaySeconds: 3
          periodSeconds: 5
```

```bash
k create deploy probed --image=nginx:1.27 --replicas=2 $do > probed.yaml   # add the probes, then:
k apply -f probed.yaml && k get pods -l app=probed -w    # READY 1/1
```

Liveness and readiness checks only start once the startup probe has succeeded.
</details>

### 5.2 Readiness removes a Pod from the Service · ⏱ 4 min · High yield

Expose `probed` as Service `probed` on port 80. In **one** Pod, delete `index.html`. Show that this Pod stops receiving traffic but isn't restarted. Then explain why.

<details><summary>Solution</summary>

```bash
k expose deploy probed --port=80
P=$(k get pod -l app=probed -o jsonpath='{.items[0].metadata.name}')
k exec $P -- rm /usr/share/nginx/html/index.html
k get pods -l app=probed                                    # that Pod: READY 0/1, RESTARTS 0
k get endpointslices -l kubernetes.io/service-name=probed -o yaml | grep -A2 conditions
```

The readiness probe failed, so the Pod is marked not-ready and taken out of the Service's endpoints. Liveness (a TCP check on port 80) still passes, so the kubelet doesn't restart it. Readiness controls traffic. Liveness controls restarts.
</details>

### 5.3 CrashLoopBackOff · ⏱ 4 min · High yield

Apply the setup, then find out why `crashy` keeps restarting and fix it so it stays `Running`.

```bash
k run crashy --image=busybox:1.36 -- sh -c 'echo "starting"; cat /config/app.conf; sleep 3600'
```

<details><summary>Solution</summary>

```bash
k get pod crashy                       # CrashLoopBackOff, restarts climbing
k logs crashy -p                       # previous container: cat: can't open '/config/app.conf'
k describe pod crashy | grep -A5 'Last State'   # Exit Code 1
```

Fix: provide the file (or change the command, if the task allows it):

```bash
k create cm app-conf --from-literal=app.conf='mode=prod'
k run crashy --image=busybox:1.36 $do -- sh -c 'echo "starting"; cat /config/app.conf; sleep 3600' > crashy.yaml
k delete pod crashy --grace-period=0 --force
# vim: add a volume from configMap app-conf, mounted at /config
k apply -f crashy.yaml && k get pod crashy
```

`k logs -p` (`--previous`) shows the output of the container that crashed. Without it you only see the current attempt, which is often empty.
</details>

### 5.4 Pending Pod · ⏱ 3 min · High yield

```bash
k run greedy --image=nginx:1.27 $do > greedy.yaml   # add requests: cpu: "64", memory: 1Ti
k apply -f greedy.yaml
```

Find out why `greedy` never starts, write the reason to `/tmp/greedy.txt`, and fix it with requests of `100m` CPU and `128Mi` memory.

<details><summary>Solution</summary>

```bash
k describe pod greedy | grep -A5 Events      # FailedScheduling ... Insufficient cpu, Insufficient memory
k get events --field-selector involvedObject.name=greedy -o jsonpath='{.items[*].message}' > /tmp/greedy.txt
k delete pod greedy --grace-period=0 --force
# vim greedy.yaml: requests cpu 100m, memory 128Mi
k apply -f greedy.yaml && k get pod greedy
```

Most fields of a running Pod are immutable. For a bare Pod, "change the spec" usually means export → delete → re-create. For a Deployment, just edit it.
</details>

### 5.5 Who's using the most? · ⏱ 2 min

Write the name of the Pod using the most CPU across **all** namespaces to `/tmp/top-pod.txt`, and the Pod with the most memory in `kube-system` to `/tmp/top-mem.txt`.

<details><summary>Solution</summary>

```bash
k top pod -A --sort-by=cpu --no-headers | head -1 | awk '{print $2}' > /tmp/top-pod.txt
k top pod -n kube-system --sort-by=memory --no-headers | head -1 | awk '{print $1}' > /tmp/top-mem.txt
```

`kubectl top` needs metrics-server. With `-A` the first column is the namespace, so the Pod name is in column 2.
</details>

### 5.6 Fix a removed API version · ⏱ 4 min · High yield

This manifest no longer applies. Find out why and update it to a served API version, keeping its behaviour.

```yaml
apiVersion: autoscaling/v2beta2
kind: HorizontalPodAutoscaler
metadata:
  name: probed
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: probed
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

<details><summary>Solution</summary>

```bash
k apply -f hpa.yaml                 # error: no matches for kind "HorizontalPodAutoscaler" in version "autoscaling/v2beta2"
k api-resources | grep -i horizontal
k api-versions | grep autoscaling   # autoscaling/v1, autoscaling/v2
k explain hpa --api-version=autoscaling/v2 | head
```

Change the first line to `apiVersion: autoscaling/v2`. The spec is identical. `k apply -f hpa.yaml && k get hpa`.

The [deprecation guide](https://kubernetes.io/docs/reference/using-api/deprecation-guide/) lists, for every removed API, which version replaces it and what changed. If fields changed, `k explain <kind>.<field> --api-version=...` shows the new shape.
</details>

### 5.7 Logs at scale · ⏱ 2 min

Show the last 20 log lines of **every** Pod of Deployment `probed`, prefixed by Pod name, covering only the last 10 minutes.

<details><summary>Solution</summary>

```bash
k logs -l app=probed --prefix --tail=20 --since=10m
# or deployment-scoped (picks one Pod):
k logs deploy/probed --tail=20
```
</details>

---

Clean up: `k delete ns d5`
