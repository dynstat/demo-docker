# 11 — Kubernetes Hands-On Workshop (KillerCoda)

> **Environment**: KillerCoda Kubernetes Playground  
> **Cluster**: Single-node (controlplane), K8s v1.35.1, containerd 2.2.1  
> **Goal**: Learn K8s from scratch by building and deploying real applications

---

## Table of Contents

- [Part 1: Environment & Container Runtime](#part-1-environment--container-runtime)
- [Part 2: Core Kubernetes Objects](#part-2-core-kubernetes-objects)
- [Part 3: Networking, Config & Secrets](#part-3-networking-config--secrets)
- [Part 4: Advanced Operations & Production](#part-4-advanced-operations--production)

---

# Part 1: Environment & Container Runtime

## 1.1 Understanding Your KillerCoda Cluster

When you open the KillerCoda Kubernetes playground, you get a **single-node cluster**.
The `controlplane` node acts as BOTH the master (runs control plane) AND the worker (runs your pods).

```
┌─────────────────────────────────────────────────────────────────┐
│                   KillerCoda Single-Node Cluster                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    controlplane node                      │  │
│  │                   (172.30.1.2)                            │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              CONTROL PLANE components               │  │  │
│  │  │  ┌──────────┐ ┌───────────┐ ┌──────────────────┐    │  │  │
│  │  │  │API Server│ │ Scheduler │ │Controller Manager│    │  │  │
│  │  │  └────┬─────┘ └─────┬─────┘ └────────┬─────────┘    │  │  │
│  │  │       │             │                 │             │  │  │
│  │  │       └──────┬──────┘─────────────────┘             │  │  │
│  │  │              │                                      │  │  │
│  │  │         ┌────▼────┐                                 │  │  │
│  │  │         │  etcd   │  (cluster state database)       │  │  │
│  │  │         └─────────┘                                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │               WORKER components                     │  │  │
│  │  │  ┌─────────┐ ┌──────────┐ ┌──────────────────────┐  │  │  │
│  │  │  │ kubelet │ │kube-proxy│ │ containerd (runtime) │  │  │  │
│  │  │  └────┬────┘ └────┬─────┘ └──────────┬───────────┘  │  │  │
│  │  │       │           │                  │              │  │  │
│  │  │       ▼           ▼                  ▼              │  │  │
│  │  │   ┌──────┐   ┌──────┐   ┌──────┐  ┌──────┐          │  │  │
│  │  │   │ Pod  │   │ Pod  │   │ Pod  │  │ Pod  │          │  │  │
│  │  │   │(your │   │(your │   │(coredns)│(kube │          │  │  │
│  │  │   │ app) │   │ app) │   │      │  │proxy)│          │  │  │
│  │  │   └──────┘   └──────┘   └──────┘  └──────┘          │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### First Commands — Explore the Cluster

```bash
# See your node(s)
kubectl get nodes -o wide

# What K8s version?
kubectl version

# What's running in the cluster already? (system pods)
kubectl get pods -A
```

**Expected output** for `kubectl get pods -A`:
```
NAMESPACE     NAME                                   READY   STATUS    RESTARTS   AGE
kube-system   coredns-xxxxxxxxx-xxxxx                1/1     Running   0          15d
kube-system   coredns-xxxxxxxxx-xxxxx                1/1     Running   0          15d
kube-system   etcd-controlplane                      1/1     Running   0          15d
kube-system   kube-apiserver-controlplane             1/1     Running   0          15d
kube-system   kube-controller-manager-controlplane    1/1     Running   0          15d
kube-system   kube-proxy-xxxxx                       1/1     Running   0          15d
kube-system   kube-scheduler-controlplane             1/1     Running   0          15d
```

> 🔍 **What you're seeing**: Every K8s component runs as a pod itself!
> The control plane components run in the `kube-system` namespace.

---

## 1.2 The Container Runtime: containerd

Your cluster uses **containerd** as its container runtime (NOT Docker).
Kubernetes dropped Docker support in v1.24. Now it talks directly to containerd via the **CRI** (Container Runtime Interface).

```
┌──────────────────── How Kubernetes Runs Containers ─────────────────────┐
│                                                                         │
│   kubectl apply ─────►  API Server ─────►  Scheduler                    │
│                             │                  │                        │
│                             │           "assign to node"                │
│                             │                  │                        │
│                             ▼                  ▼                        │
│                          kubelet  ◄────────────┘                        │
│                             │                                           │
│                             │  (speaks CRI protocol)                    │
│                             ▼                                           │
│                        containerd                                       │
│                             │                                           │
│                             ├──► pull image from registry               │
│                             ├──► create container sandbox               │
│                             ├──► configure networking (CNI)             │
│                             └──► start container process                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2.1 Three CLI Tools for Containers

On KillerCoda you have **three** container CLI tools. Each has a different purpose:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Tool       │ Purpose                        │ When to use             │
├─────────────┼────────────────────────────────┼─────────────────────────┤
│  docker     │ Build images, dev workflow     │ Building container      │
│             │                                │ images (Dockerfile)     │
├─────────────┼────────────────────────────────┼─────────────────────────┤
│  ctr        │ Low-level containerd client    │ Import/export images,   │
│             │                                │ inspect namespaces      │
├─────────────┼────────────────────────────────┼─────────────────────────┤
│  crictl     │ CRI-compatible CLI             │ Debug pods/containers   │
│             │ (what kubelet sees)            │ from the runtime level  │
└─────────────┴────────────────────────────────┴─────────────────────────┘
```

---

## 1.3 `ctr` — The containerd CLI

`ctr` talks directly to the containerd daemon. It uses **namespaces** to isolate images:

```
containerd namespaces:
├── default         ← used by `docker` / manual `ctr` commands
├── moby            ← Docker Engine's namespace
└── k8s.io          ← Kubernetes namespace (kubelet stores images here)
```

> ⚠️ **Key insight**: If you build an image with `docker build`, it lives in the `moby`
> namespace. Kubernetes can't see it! You must **import** it into `k8s.io`.

### Essential `ctr` Commands

```bash
# ── Namespaces ──────────────────────────────────────
ctr namespaces list                      # list all containerd namespaces

# ── Images (in k8s.io namespace) ────────────────────
ctr -n k8s.io images list               # images Kubernetes can see
ctr -n k8s.io images list | grep pause  # find the pause image
ctr -n k8s.io images list | wc -l       # count images

# ── Import an image into k8s.io ─────────────────────
# This is HOW you make docker-built images available to K8s:
docker save my-app:v1 | ctr -n k8s.io images import -

# ── Pull an image directly ──────────────────────────
ctr -n k8s.io images pull docker.io/library/nginx:alpine

# ── Delete an image ─────────────────────────────────
ctr -n k8s.io images remove docker.io/library/nginx:alpine

# ── Containers (low-level) ──────────────────────────
ctr -n k8s.io containers list           # running containerd containers
ctr -n k8s.io tasks list                # running processes
```

### Try it now:

```bash
# See what images Kubernetes already has:
ctr -n k8s.io images list | head -20

# You'll see images like:
#   registry.k8s.io/pause:3.10
#   registry.k8s.io/coredns/coredns:v1.12.0
#   registry.k8s.io/etcd:3.5.21-0
#   registry.k8s.io/kube-apiserver:v1.35.1
```

---

## 1.4 `crictl` — The CRI Debug Tool

`crictl` is the **Kubernetes-native** way to inspect containers. It speaks the same
CRI protocol that kubelet uses, so it shows exactly what K8s sees.

```
┌─────────── crictl vs docker vs ctr ──────────────┐
│                                                  │
│  crictl ──► CRI  ──► containerd    (K8s view)    │
│  ctr    ──────────► containerd    (raw access)   │
│  docker ──► dockerd ──► containerd (Docker view) │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Essential `crictl` Commands

```bash
# ── Pods (crictl sees K8s pods!) ────────────────────
crictl pods                              # list all pods
crictl pods --name coredns               # filter by name
crictl pods --state Ready                # filter by state
crictl pods --namespace kube-system      # filter by namespace

# ── Containers ──────────────────────────────────────
crictl ps                                # running containers
crictl ps -a                             # ALL containers (incl. stopped)
crictl ps --name etcd                    # filter by name

# ── Inspect a container ────────────────────────────
crictl inspect <CONTAINER_ID>            # full JSON details
crictl logs <CONTAINER_ID>               # container logs
crictl exec -it <CONTAINER_ID> sh        # exec into container

# ── Images ──────────────────────────────────────────
crictl images                            # images available to K8s
crictl images | grep nginx               # search for specific image
crictl rmi <IMAGE_ID>                    # remove image

# ── Stats ───────────────────────────────────────────
crictl stats                             # CPU/memory usage per container
```

### Try it now:

```bash
# List all running pods (system-level view):
crictl pods

# List all running containers:
crictl ps

# Pick a container ID and inspect it:
crictl inspect $(crictl ps -q | head -1) | head -30

# Check resource usage:
crictl stats
```

---

## 1.5 `kubectl` — The Kubernetes CLI

`kubectl` is your **primary** tool. It talks to the API Server, not containerd directly.

```
┌───────────────────── kubectl Architecture ──────────────────────┐
│                                                                 │
│   YOU  ──►  kubectl  ──► (HTTPS) ──►  API Server  ──►  etcd     │
│                                           │                     │
│                                           ├──►  Scheduler       │
│                                           ├──►  Controllers     │
│                                           └──►  kubelet(s)      │
│                                                                 │
│   kubectl uses ~/.kube/config for:                              │
│     • cluster URL        (where is the API server?)             │
│     • credentials        (who am I?)                            │
│     • context            (which cluster + user + namespace?)    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5.1 kubectl Verb Cheatsheet

```bash
# ── READ operations ─────────────────────────────────
kubectl get <resource>                   # list resources
kubectl get pods                         # list pods in current namespace
kubectl get pods -A                      # list pods in ALL namespaces
kubectl get pods -o wide                 # extra columns (IP, node)
kubectl get pods -o yaml                 # full YAML definition
kubectl get pods -w                      # watch (live updates)

kubectl describe <resource> <name>       # detailed info + events
kubectl logs <pod-name>                  # container logs
kubectl logs <pod-name> -f               # follow/stream logs
kubectl logs <pod-name> -c <container>   # specific container in multi-container pod

# ── WRITE operations ────────────────────────────────
kubectl apply -f <file.yaml>             # create or update from file
kubectl create -f <file.yaml>            # create only (error if exists)
kubectl delete -f <file.yaml>            # delete resources in file
kubectl delete pod <name>                # delete a specific pod

# ── DEBUG operations ────────────────────────────────
kubectl exec -it <pod> -- /bin/sh        # shell into a pod
kubectl exec <pod> -- env                # run a single command
kubectl port-forward <pod> 8080:80       # forward local port to pod
kubectl top pods                         # CPU/memory usage (needs metrics-server)

# ── CLUSTER operations ─────────────────────────────
kubectl get nodes                        # list nodes
kubectl get namespaces                   # list namespaces
kubectl get events --sort-by='.lastTimestamp'   # recent events
kubectl cluster-info                     # API server URL
kubectl api-resources                    # ALL available resource types
```

### 1.5.2 Output Formatting

```bash
# JSON Path — extract specific fields
kubectl get pods -o jsonpath='{.items[*].metadata.name}'

# Custom columns
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,IP:.status.podIP

# Sort
kubectl get pods --sort-by='.metadata.creationTimestamp'
```

### Try it now:

```bash
# Explore your cluster:
kubectl cluster-info
kubectl get namespaces
kubectl get pods -A -o wide

# What types of resources can you create?
kubectl api-resources | head -20

# Check your kubeconfig:
kubectl config view
```

---

## 1.6 Building Images & Making Them Available to K8s

This is the **critical workflow** on KillerCoda. Since there's no remote registry,
you build with `docker` and import into containerd's `k8s.io` namespace.

```
┌──────── Image Build → K8s Workflow ────────┐
│                                            │
│  Step 1: docker build -t myapp:v1 .        │
│            │                               │
│            ▼                               │
│  ┌─────────────────┐                       │
│  │  Docker daemon   │  (moby namespace)    │
│  │  stores image    │                      │
│  └────────┬────────┘                       │
│            │                               │
│  Step 2: docker save myapp:v1              │
│            │                               │
│            ▼                               │
│  ┌─────────────────┐                       │
│  │   tar stream     │                      │
│  └────────┬────────┘                       │
│            │                               │
│  Step 3: ctr -n k8s.io images import -     │
│            │                               │
│            ▼                               │
│  ┌─────────────────┐                       │
│  │  containerd      │  (k8s.io namespace)  │
│  │  ← kubelet can   │                      │
│  │    see it now!   │                      │
│  └─────────────────┘                       │
│                                            │
│  One-liner:                                │
│  docker build -t myapp:v1 . && \           │
│  docker save myapp:v1 | \                  │
│  ctr -n k8s.io images import -             │
│                                            │
└────────────────────────────────────────────┘
```

### Quick Practice — Build & Run a test container

```bash
# Create a tiny test Dockerfile
mkdir -p /tmp/test-app && cd /tmp/test-app

cat << 'EOF' > Dockerfile
FROM alpine:3.20
CMD ["echo", "Hello from Kubernetes!"]
EOF

# Build it
docker build -t test-app:v1 .

# Verify it's in Docker
docker images | grep test-app

# Import into containerd for K8s
docker save test-app:v1 | ctr -n k8s.io images import -

# Verify K8s can see it
crictl images | grep test-app

# Run it as a K8s pod!
kubectl run test-pod --image=test-app:v1 --restart=Never --image-pull-policy=Never

# Check the pod
kubectl get pods
kubectl logs test-pod

# Clean up
kubectl delete pod test-pod
```

---

## 1.7 Key Concepts Summary (Part 1)

```
┌──────────────────── Part 1 Summary ─────────────────────────┐
│                                                              │
│  ✅ KillerCoda = single-node cluster (controlplane)         │
│  ✅ Container runtime = containerd 2.2.1 (NOT Docker)       │
│  ✅ Three CLI tools:                                        │
│       docker  → build images                                │
│       ctr     → low-level containerd (import images)        │
│       crictl  → CRI debug (see what kubelet sees)           │
│  ✅ kubectl   → primary K8s management tool                 │
│  ✅ Image workflow: docker build → docker save → ctr import │
│  ✅ Images must be in k8s.io namespace for K8s to use them  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# Part 2: Core Kubernetes Objects

## 2.1 Pods — The Smallest Deployable Unit

A **Pod** is a wrapper around one or more containers that share:
- The same **network** namespace (same IP address, same `localhost`)
- The same **storage volumes**
- The same **lifecycle** (they start and die together)

```
┌───────────────────── Pod ─────────────────────────┐
│                                                   │
│   Pod Name: my-app-pod                            │
│   Pod IP:   10.244.0.15                           │
│                                                   │
│   ┌──────────────┐    ┌──────────────┐            │
│   │  Container 1 │    │  Container 2 │            │
│   │  (main app)  │    │  (sidecar/   │            │
│   │              │    │   log agent) │            │
│   │  Port: 8080  │    │  Port: 9090  │            │
│   └──────┬───────┘    └──────┬───────┘            │
│          │                   │                    │
│          └───── localhost ───┘                    │
│                    │                              │
│   ┌────────────────▼────────────────────┐         │
│   │          Shared Volume              │         │
│   │       /var/log/app                  │         │
│   └─────────────────────────────────────┘         │
│                                                   │
└───────────────────────────────────────────────────┘
```

> 🔍 **Rule of thumb**: 99% of pods have **one container**. Only use multi-container
> pods for tightly-coupled helpers (sidecars, log shippers, proxies).

### 2.1.1 Creating Your First Pod

**Imperative way** (quick, for testing):
```bash
# Run a single nginx pod
kubectl run my-nginx --image=nginx:alpine --port=80

# Check it
kubectl get pods
kubectl get pods -o wide     # see IP and node

# Detailed info
kubectl describe pod my-nginx

# Logs
kubectl logs my-nginx

# Exec into it
kubectl exec -it my-nginx -- sh
# Inside: curl localhost   (then exit)

# Delete it
kubectl delete pod my-nginx
```

**Declarative way** (production, version-controlled):
```yaml
# pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-nginx
  labels:
    app: nginx
    env: demo
spec:
  containers:
    - name: nginx
      image: nginx:alpine
      ports:
        - containerPort: 80
```

```bash
# Apply it
kubectl apply -f pod.yaml

# View
kubectl get pods
kubectl describe pod my-nginx

# Delete
kubectl delete -f pod.yaml
```

### 2.1.2 Pod Lifecycle

```
┌─────────────────── Pod Lifecycle ─────────────────────── ┐
│                                                          │
│   Pending ──► ContainerCreating ──► Running ──► Succeeded│
│      │                                  │       (or)     │
│      │                                  └──► Failed      │
│      │                                                   │
│      └──► (ImagePullBackOff — can't find image)          │
│      └──► (CrashLoopBackOff — app keeps crashing)        │
│                                                          │
│   Common status meanings:                                │
│     Pending          = waiting for scheduling/image pull │
│     Running          = at least one container is running │
│     Succeeded        = all containers exited with 0      │
│     Failed           = a container exited non-zero       │
│     CrashLoopBackOff = K8s is backing off restart        │
│     ImagePullBackOff = can't pull the container image    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Try it — Observe lifecycle:

```bash
# Create a pod that finishes quickly
kubectl run lifecycle-demo --image=busybox --restart=Never -- echo "done"

# Watch it go through states
kubectl get pods -w
# You'll see:  Pending → ContainerCreating → Completed

# Create a pod that crashes (to see CrashLoopBackOff)
kubectl run crash-demo --image=busybox -- /bin/false

# Watch it crash-loop
kubectl get pods -w
# After a few restarts, you'll see CrashLoopBackOff

# Clean up
kubectl delete pod lifecycle-demo crash-demo
```

---

## 2.2 Deployments — Managing Pod Replicas

**Never create bare pods in production.** Use a **Deployment** instead.
A Deployment creates a **ReplicaSet**, which manages pod replicas.

```
┌──────────────────── Deployment Architecture ──────────────────┐
│                                                               │
│  Deployment: my-app                                           │
│  ├── desired replicas: 3                                      │
│  ├── strategy: RollingUpdate                                  │
│  │                                                            │
│  └── ReplicaSet: my-app-6d4b5c8f7  (auto-created)             │
│      ├── desired: 3, current: 3, ready: 3                     │
│      │                                                        │
│      ├── Pod: my-app-6d4b5c8f7-abc12  ✅ Running             │
│      ├── Pod: my-app-6d4b5c8f7-def34  ✅ Running             │
│      └── Pod: my-app-6d4b5c8f7-ghi56  ✅ Running             │
│                                                               │
│  What happens when a pod dies?                                │
│    ReplicaSet notices → creates a new pod → back to 3         │
│                                                               │
│  What happens when you update the image?                      │
│    Deployment creates NEW ReplicaSet → scales it up           │
│    → scales OLD ReplicaSet down → zero-downtime update        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 2.2.1 Creating a Deployment

```bash
# Imperative (quick)
kubectl create deployment nginx-deploy --image=nginx:alpine --replicas=3

# Check what was created
kubectl get deployments
kubectl get replicasets
kubectl get pods

# You'll see the hierarchy:
#   Deployment → ReplicaSet → 3 Pods
```

**Declarative (recommended)**:
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:                    # must match template labels
      app: nginx
  template:                         # ← this IS the pod template
    metadata:
      labels:
        app: nginx                  # must match selector above
    spec:
      containers:
        - name: nginx
          image: nginx:alpine
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f deployment.yaml
kubectl get deploy,rs,pods         # see the full hierarchy
```

### 2.2.2 Understanding the Label-Selector Connection

```
┌──────────── Labels & Selectors ────────────────┐
│                                                │
│  Deployment                                    │
│  ┌─────────────────────────────┐               │
│  │ spec.selector.matchLabels:  │               │
│  │   app: nginx   ─────────────┼──┐             │
│  └─────────────────────────────┘  │            │
│                                   │  MUST      │
│  Pod Template                     │  MATCH     │
│  ┌─────────────────────────────┐  │            │
│  │ metadata.labels:            │  │            │
│  │   app: nginx   ◄────────────┼──┘             │
│  └─────────────────────────────┘               │
│                                                │
│  The selector is HOW the ReplicaSet finds      │
│  "its" pods. Without matching labels, it       │
│  won't know which pods to manage!              │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 2.3 Scaling

### Manual Scaling

```bash
# Scale up to 5 replicas
kubectl scale deployment nginx-deploy --replicas=5

# Watch new pods appear
kubectl get pods -w

# Scale down to 2
kubectl scale deployment nginx-deploy --replicas=2

# Watch pods terminate
kubectl get pods -w
```

### Self-Healing Demo

```bash
# List pods
kubectl get pods

# Delete one pod (simulate a crash)
kubectl delete pod <POD_NAME>

# Immediately check — ReplicaSet creates a replacement!
kubectl get pods
# Notice: new pod name, same replica count
```

```
┌──────────── Self-Healing in Action ─────────────┐
│                                                 │
│  Before:     Pod-abc12 ✅  Pod-def34 ✅        │
│                                                 │
│  You delete Pod-abc12 ❌                       │
│                                                 │
│  ReplicaSet: "I need 2 pods, I only see 1!"     │
│              → creates Pod-xyz99 ✅            │
│                                                 │
│  After:      Pod-xyz99 ✅  Pod-def34 ✅        │
│              (always maintains desired count)    │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 2.4 Rolling Updates & Rollbacks

### 2.4.1 Rolling Update

When you change the image (or any pod template field), the Deployment performs
a **rolling update** — replacing pods gradually with zero downtime.

```bash
# Current state
kubectl get deploy nginx-deploy -o wide

# Update the image
kubectl set image deployment/nginx-deploy nginx=nginx:1.27

# Watch the rollout happen
kubectl rollout status deployment/nginx-deploy

# See the pods being replaced
kubectl get pods -w
```

```
┌──────────── Rolling Update Process ────────────────────────┐
│                                                             │
│  Time 0 (before update):                                   │
│    RS-old: Pod-1 ✅  Pod-2 ✅  Pod-3 ✅  (nginx:alpine)   │
│    RS-new: (doesn't exist yet)                             │
│                                                             │
│  Time 1 (update starts):                                   │
│    RS-old: Pod-1 ✅  Pod-2 ✅  Pod-3 ✅                    │
│    RS-new: Pod-A 🔄  (creating, nginx:1.27)                │
│                                                             │
│  Time 2 (new pod ready):                                   │
│    RS-old: Pod-1 ✅  Pod-2 ✅  ← Pod-3 terminating        │
│    RS-new: Pod-A ✅                                        │
│                                                             │
│  Time 3 (continues):                                       │
│    RS-old: Pod-1 ✅  ← Pod-2 terminating                  │
│    RS-new: Pod-A ✅  Pod-B ✅                              │
│                                                             │
│  Time 4 (done):                                            │
│    RS-old: (0 replicas)                                    │
│    RS-new: Pod-A ✅  Pod-B ✅  Pod-C ✅  (nginx:1.27)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4.2 Rollback

```bash
# Check rollout history
kubectl rollout history deployment/nginx-deploy

# See details of a specific revision
kubectl rollout history deployment/nginx-deploy --revision=1

# Rollback to previous version
kubectl rollout undo deployment/nginx-deploy

# Rollback to a specific revision
kubectl rollout undo deployment/nginx-deploy --to-revision=1

# Verify
kubectl get deploy nginx-deploy -o wide
kubectl rollout status deployment/nginx-deploy
```

### 2.4.3 Update Strategies

```yaml
# In deployment spec:
spec:
  strategy:
    type: RollingUpdate          # default
    rollingUpdate:
      maxUnavailable: 1          # max pods that can be down during update
      maxSurge: 1                # max extra pods above desired count

  # OR

  strategy:
    type: Recreate               # kill ALL old, then create ALL new
                                 # causes downtime, but simpler
```

---

## 2.5 Namespaces — Virtual Clusters

Namespaces provide **isolation** within a cluster. Different teams, environments,
or projects can use separate namespaces.

```
┌──────────── Namespace Isolation ─────────────┐
│                                               │
│  Cluster                                     │
│  ├── namespace: default       (your pods)    │
│  ├── namespace: kube-system   (system pods)  │
│  ├── namespace: python-demo   (project 1)    │
│  └── namespace: java-react-demo (project 2)  │
│                                               │
│  Resources in different namespaces:           │
│    ✅ can communicate (via DNS)              │
│    ✅ have separate resource quotas           │
│    ✅ have separate RBAC rules               │
│    ❌ can't see each other with plain names  │
│       (must use: svc.namespace.svc.cluster)  │
│                                               │
└───────────────────────────────────────────────┘
```

```bash
# List namespaces
kubectl get namespaces

# Create a namespace
kubectl create namespace my-test

# Run a pod in that namespace
kubectl run test --image=nginx:alpine -n my-test

# List pods in that namespace
kubectl get pods -n my-test

# List pods in ALL namespaces
kubectl get pods -A

# Set a default namespace (so you don't type -n every time)
kubectl config set-context --current --namespace=my-test

# Delete namespace (deletes EVERYTHING inside it!)
kubectl delete namespace my-test
```

---

## 2.6 Key Concepts Summary (Part 2)

```
┌──────────────────── Part 2 Summary ─────────────────────────┐
│                                                              │
│  ✅ Pod = smallest unit, wraps 1+ containers                │
│  ✅ Never use bare pods → use Deployments                   │
│  ✅ Deployment → ReplicaSet → Pods (hierarchy)              │
│  ✅ Labels + Selectors = how K8s connects objects           │
│  ✅ Scaling: kubectl scale --replicas=N                     │
│  ✅ Self-healing: ReplicaSet recreates dead pods            │
│  ✅ Rolling updates: zero-downtime image changes            │
│  ✅ Rollback: kubectl rollout undo                          │
│  ✅ Namespaces: isolate resources within a cluster          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# Part 3: Networking, Config & Secrets

## 3.1 Services — Exposing Pods to the Network

Pods get **random IPs** that change whenever they restart. You can't rely on pod IPs.
A **Service** provides a **stable DNS name + IP** that load-balances across matching pods.

```
┌──────────── The Problem Services Solve ──────────────────┐
│                                                           │
│  Without Services:                                       │
│    Client → 10.244.0.15 (Pod-1 IP)    ← pod dies → ❌   │
│    Client → 10.244.0.16 (Pod-2 IP)    ← pod dies → ❌   │
│    (Pod IPs are random and ephemeral!)                   │
│                                                           │
│  With a Service:                                         │
│    Client → my-svc (10.96.45.12)     ← stable forever  │
│              │                                            │
│              ├──► Pod-1 (10.244.0.15)                    │
│              ├──► Pod-2 (10.244.0.16)                    │
│              └──► Pod-3 (10.244.0.17)                    │
│              (kube-proxy load-balances via iptables)     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 3.1.1 Service Types

```
┌──────────── Service Types ───────────────────────────────────────┐
│                                                                  │
│  Type          │ Accessible From        │ Use Case               │
│  ──────────────┼────────────────────────┼─────────────────────── │
│  ClusterIP     │ Inside cluster only    │ Backend APIs,          │
│  (default)     │                        │ databases              │
│  ──────────────┼────────────────────────┼─────────────────────── │
│  NodePort      │ Outside via            │ Dev/testing,           │
│                │ <NodeIP>:<30000-32767> │ KillerCoda demos       │
│  ──────────────┼────────────────────────┼─────────────────────── │
│  LoadBalancer  │ External LB            │ Production             │
│                │ (cloud only)           │ (AWS/GCP/Azure)        │
│  ──────────────┼────────────────────────┼─────────────────────── │
│  ExternalName  │ DNS alias to           │ External services      │
│                │ external service       │ (e.g. RDS endpoint)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1.2 ClusterIP (Internal Only)

```bash
# First, create a deployment
kubectl create deployment web --image=nginx:alpine --replicas=3

# Expose it as ClusterIP (default)
kubectl expose deployment web --port=80 --target-port=80

# Check the service
kubectl get svc web
# NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
# web    ClusterIP   10.96.132.45   <none>        80/TCP    5s

# Test it from inside the cluster:
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never \
  -- curl http://web.default.svc.cluster.local

# Or shorter (same namespace):
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never \
  -- curl http://web
```

### 3.1.3 NodePort (External Access)

```
┌──────────── NodePort Networking ─────────────────────┐
│                                                      │
│  External User                                       │
│       │                                              │
│       ▼ http://172.30.1.2:30080                      │
│  ┌────────────────────────────┐                      │
│  │  controlplane node         │                      │
│  │  (NodePort 30080 open)     │                      │
│  │       │                    │                      │
│  │       ▼                    │                      │
│  │  ┌─────────────────┐      │                       │
│  │  │ Service (NodePort)│     │                      │
│  │  │ ClusterIP:10.96.x│     │                       │
│  │  │ NodePort: 30080  │     │                       │
│  │  └───────┬─────────┘      │                       │
│  │          │                 │                      │
│  │    ┌─────┼─────┐          │                       │
│  │    ▼     ▼     ▼          │                       │
│  │  Pod-1  Pod-2  Pod-3      │                       │
│  └────────────────────────────┘                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

```bash
# Expose as NodePort
kubectl expose deployment web --type=NodePort --port=80 --target-port=80 --name=web-np

# Check the assigned port
kubectl get svc web-np
# NAME     TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)       AGE
# web-np   NodePort   10.96.200.55   <none>        80:31234/TCP  5s
#                                                  ↑     ↑
#                                            service  node port

# Access it!
curl http://172.30.1.2:31234

# Or specify a fixed NodePort (30080):
kubectl delete svc web-np
kubectl expose deployment web --type=NodePort --port=80 --name=web-np \
  --overrides='{"spec":{"ports":[{"port":80,"nodePort":30080,"targetPort":80}]}}'
```

### 3.1.4 DNS Service Discovery

Kubernetes runs **CoreDNS** which gives every Service a DNS name:

```
┌──────────── K8s DNS Format ──────────────────────────┐
│                                                       │
│  Full format:                                        │
│    <service>.<namespace>.svc.cluster.local            │
│                                                       │
│  Examples:                                           │
│    python-backend-svc.python-demo.svc.cluster.local  │
│    web.default.svc.cluster.local                     │
│                                                       │
│  Short forms (within same namespace):                │
│    python-backend-svc           ← just the name      │
│    python-backend-svc.python-demo  ← name.namespace  │
│                                                       │
│  Cross-namespace call:                               │
│    curl http://web.other-namespace                   │
│    (must include namespace when calling across)      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

```bash
# Verify DNS is working — look up a service from inside a pod:
kubectl run dns-test --image=busybox --rm -it --restart=Never \
  -- nslookup web.default.svc.cluster.local

# You'll see something like:
# Server:    10.96.0.10  (CoreDNS)
# Address:   10.96.0.10:53
# Name:      web.default.svc.cluster.local
# Address:   10.96.132.45
```

---

## 3.2 ConfigMaps — Externalizing Configuration

ConfigMaps store **non-sensitive** configuration as key-value pairs.
They decouple config from container images.

```
┌──────────── ConfigMap Flow ──────────────────────────┐
│                                                      │
│  ConfigMap: app-config                               │
│  ┌─────────────────────────────┐                     │
│  │  APP_NAME = "my-app"       │                      │
│  │  APP_VERSION = "2.0.0"     │                      │
│  │  LOG_LEVEL = "info"        │                      │
│  └────────────┬────────────────┘                     │
│               │                                      │
│    ┌──────────┼──────────────┐                       │
│    │  inject  │   inject     │                       │
│    │  as ENV  │   as FILE    │                       │
│    ▼          ▼              │                       │
│  ┌────────┐  ┌────────────┐ │                        │
│  │ Pod    │  │ Pod        │ │                        │
│  │ $APP_  │  │ /etc/config│ │                        │
│  │ NAME   │  │ /app.conf  │ │                        │
│  └────────┘  └────────────┘ │                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Creating ConfigMaps

```bash
# ── From command line ──────────────────────────
kubectl create configmap my-config \
  --from-literal=APP_NAME=my-app \
  --from-literal=LOG_LEVEL=info

# ── From a file ────────────────────────────────
echo "APP_NAME=my-app" > config.env
kubectl create configmap my-config --from-env-file=config.env

# ── View it ────────────────────────────────────
kubectl get configmap my-config -o yaml
kubectl describe configmap my-config
```

**Declarative (YAML)**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  APP_NAME: "my-app"
  APP_VERSION: "2.0.0"
  LOG_LEVEL: "info"
```

### Using ConfigMaps in Pods

```yaml
# Method 1: All keys as env vars (envFrom)
spec:
  containers:
    - name: app
      envFrom:
        - configMapRef:
            name: my-config        # injects ALL keys as env vars

# Method 2: Specific keys
spec:
  containers:
    - name: app
      env:
        - name: MY_APP_NAME       # env var name in container
          valueFrom:
            configMapKeyRef:
              name: my-config     # ConfigMap name
              key: APP_NAME       # key in ConfigMap

# Method 3: Mount as file
spec:
  containers:
    - name: app
      volumeMounts:
        - name: config-vol
          mountPath: /etc/config
  volumes:
    - name: config-vol
      configMap:
        name: my-config           # each key = a file
```

---

## 3.3 Secrets — Sensitive Data

Secrets are like ConfigMaps but for **sensitive data** (passwords, API keys, tokens).
Values are **base64 encoded** (not encrypted by default!).

```bash
# Create a secret
kubectl create secret generic db-creds \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASS=supersecret123

# View it (values are base64)
kubectl get secret db-creds -o yaml

# Decode a value
kubectl get secret db-creds -o jsonpath='{.data.DB_PASS}' | base64 -d
```

**Declarative (YAML)**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-creds
type: Opaque
data:
  DB_USER: YWRtaW4=                # echo -n "admin" | base64
  DB_PASS: c3VwZXJzZWNyZXQxMjM=   # echo -n "supersecret123" | base64
```

```yaml
# Use in a pod (same as ConfigMap but secretKeyRef):
spec:
  containers:
    - name: app
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-creds
              key: DB_PASS
```

---

## 3.4 Health Probes — Liveness & Readiness

Probes tell Kubernetes whether your app is **alive** and **ready to serve traffic**.

```
┌──────────── Probe Types ─────────────────────────────────────┐
│                                                               │
│  Probe       │ Question it answers      │ Action on failure  │
│  ────────────┼──────────────────────────┼─────────────────── │
│  Liveness    │ "Is the app still alive?"│ RESTART the pod    │
│              │                          │ (container killed) │
│  ────────────┼──────────────────────────┼─────────────────── │
│  Readiness   │ "Can it serve traffic?"  │ REMOVE from Service│
│              │                          │ (no traffic sent)  │
│  ────────────┼──────────────────────────┼─────────────────── │
│  Startup     │ "Has it started yet?"    │ Keep waiting       │
│              │ (slow-starting apps)     │ (don't kill yet)   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

```
┌──────────── How Probes Work ─────────────────────────────┐
│                                                           │
│  kubelet runs probes periodically on each container:      │
│                                                           │
│  Every 10s: GET /api/health → 200 OK? ✅ alive           │
│             GET /api/health → 500?    ❌ restart pod     │
│                                                           │
│  Every 5s:  GET /api/ready  → 200 OK? ✅ in Service      │
│             GET /api/ready  → 503?    ⚠️  remove from    │
│                                           Service LB      │
│                                                           │
│  Timeline:                                                │
│  ─────────────────────────────────────────────────        │
│  0s          5s           15s          25s                │
│  │ startup   │ ready      │            │                  │
│  │ probe     │ probe ✅   │ liveness ✅│ liveness ✅    │
│  │ waiting   │ → add to   │ → still    │ → still          │
│  │           │   Service  │   alive    │   alive          │
│  ─────────────────────────────────────────────────        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

```yaml
# Example: HTTP probes
spec:
  containers:
    - name: app
      image: my-app:v1
      ports:
        - containerPort: 5000
      livenessProbe:
        httpGet:
          path: /api/health
          port: 5000
        initialDelaySeconds: 5     # wait before first check
        periodSeconds: 10          # check every 10s
        failureThreshold: 3        # restart after 3 failures
      readinessProbe:
        httpGet:
          path: /api/health
          port: 5000
        initialDelaySeconds: 3
        periodSeconds: 5
```

### Probe Methods

```yaml
# HTTP GET (most common for web apps)
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080

# TCP Socket (databases, non-HTTP services)
livenessProbe:
  tcpSocket:
    port: 5432             # just checks if port is open

# Exec command (custom check)
livenessProbe:
  exec:
    command: ["cat", "/tmp/healthy"]
```

---

## 3.5 Downward API — Pod Metadata as Env Vars

The **Downward API** lets pods know about themselves without calling the K8s API.

```yaml
env:
  # Pod's own name
  - name: POD_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name

  # Pod's IP address
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP

  # Namespace the pod is in
  - name: POD_NAMESPACE
    valueFrom:
      fieldRef:
        fieldPath: metadata.namespace

  # Node the pod runs on
  - name: NODE_NAME
    valueFrom:
      fieldRef:
        fieldPath: spec.nodeName
```

> 🔍 Both of our demo projects use this! The `/api/info` endpoint returns pod
> metadata injected via the Downward API.

---

## 3.6 Key Concepts Summary (Part 3)

```
┌──────────────────── Part 3 Summary ─────────────────────────┐
│                                                              │
│  ✅ Service = stable IP + DNS for a set of pods             │
│  ✅ ClusterIP = internal only (backend-to-backend)          │
│  ✅ NodePort = external access via <NodeIP>:<port>          │
│  ✅ DNS: <svc>.<namespace>.svc.cluster.local                │
│  ✅ ConfigMap = non-sensitive config (key-value pairs)      │
│  ✅ Secret = sensitive data (base64, not encrypted)         │
│  ✅ Liveness probe → restart dead containers                │
│  ✅ Readiness probe → remove unready pods from Service      │
│  ✅ Downward API → inject pod metadata as env vars          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# Part 4: Advanced Operations & Production

## 4.1 Resource Management — Requests & Limits

Every container should declare how much CPU/memory it needs (requests) and the
maximum it's allowed to use (limits).

```
┌──────────── Requests vs Limits ──────────────────────────────┐
│                                                              │
│  Request = "minimum guaranteed"  →  used by Scheduler        │
│  Limit   = "maximum allowed"     →  enforced by kubelet      │
│                                                              │
│  ┌─────── Node capacity: 2 CPU, 4Gi RAM ──────────────┐      │
│  │                                                     │     │
│  │  Pod-A: request 200m, limit 500m  ← guaranteed 200m │     │
│  │  Pod-B: request 300m, limit 800m  ← guaranteed 300m │     │
│  │  Pod-C: request 100m, limit 400m  ← guaranteed 100m │     │
│  │                                                     │     │
│  │  Total requested: 600m (scheduler checks this fits) │     │
│  │  Total limit:    1700m (can burst beyond requests)  │     │
│  │                                                     │     │
│  │  If Pod-A exceeds 500m CPU → throttled (slowed)     │     │
│  │  If Pod-A exceeds memory limit → OOMKilled (killed) │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  CPU units:    1 = 1 vCPU,  100m = 0.1 vCPU  (m=millicpu)    │
│  Memory units: Mi = mebibytes,  Gi = gibibytes               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

```yaml
resources:
  requests:
    cpu: 100m         # needs at least 0.1 CPU
    memory: 128Mi     # needs at least 128 MiB RAM
  limits:
    cpu: 500m         # can use max 0.5 CPU
    memory: 256Mi     # killed if exceeds 256 MiB
```

### Try it — See resource usage:

```bash
# Check if metrics-server is installed:
kubectl top nodes
kubectl top pods -A

# If metrics-server is not installed:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Wait 30s then try:
kubectl top pods -A
```

---

## 4.2 Debugging & Troubleshooting

```
┌──────────── Debug Decision Tree ─────────────────────────────┐
│                                                              │
│  Pod not starting?                                           │
│  ├── kubectl describe pod <name>    ← check Events section   │
│  ├── Status: ImagePullBackOff?      ← wrong image name/tag   │
│  ├── Status: Pending?               ← no node can fit it     │
│  └── Status: CrashLoopBackOff?      ← app is crashing        │
│       └── kubectl logs <pod>        ← see app error          │
│       └── kubectl logs <pod> --previous  ← last crash log    │
│                                                              │
│  Pod running but not working?                                │
│  ├── kubectl logs <pod> -f          ← stream live logs       │
│  ├── kubectl exec -it <pod> -- sh   ← get shell inside       │
│  ├── kubectl port-forward <pod> 8080:80  ← test locally      │
│  └── kubectl get events             ← cluster-wide events    │
│                                                              │
│  Service not reachable?                                      │
│  ├── kubectl get endpoints <svc>    ← are pods registered?   │
│  ├── kubectl describe svc <svc>     ← check selector         │
│  └── Labels match? (svc selector vs pod labels)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Common Debug Commands

```bash
# ── Pod-level debugging ────────────────────────
kubectl describe pod <POD_NAME>          # full details + events
kubectl logs <POD_NAME>                  # stdout/stderr
kubectl logs <POD_NAME> --previous       # logs from LAST crash
kubectl logs <POD_NAME> -c <container>   # multi-container pod
kubectl exec -it <POD_NAME> -- sh        # interactive shell
kubectl exec <POD_NAME> -- env           # check env vars
kubectl exec <POD_NAME> -- cat /etc/resolv.conf  # DNS config

# ── Service-level debugging ────────────────────
kubectl get endpoints <SVC_NAME>         # which pods are behind it?
kubectl describe svc <SVC_NAME>          # full service details

# ── Cluster-level debugging ────────────────────
kubectl get events --sort-by='.lastTimestamp'  # recent events
kubectl get pods -A | grep -v Running          # non-running pods
kubectl get nodes                              # node health

# ── Network debugging from inside a pod ───────
kubectl run netdebug --image=nicolaka/netshoot --rm -it --restart=Never -- bash
# Inside: curl, nslookup, ping, traceroute, tcpdump are all available
```

### Hands-on Debug Exercise

```bash
# Create a broken deployment (wrong image)
kubectl create deployment broken --image=nginx:doesnotexist

# Watch it fail
kubectl get pods -w

# Debug it
kubectl describe pod $(kubectl get pods -l app=broken -o name | head -1)
# Look at Events: "Failed to pull image..."

# Fix it
kubectl set image deployment/broken nginx=nginx:alpine

# Watch it recover
kubectl get pods -w

# Clean up
kubectl delete deployment broken
```

---

## 4.3 Horizontal Pod Autoscaler (HPA)

HPA automatically scales deployments based on CPU/memory usage.

```
┌──────────── HPA Autoscaling ─────────────────────────────┐
│                                                          │
│  HPA watches → metrics-server → CPU/memory of pods       │
│                                                          │
│  Rule: "Keep average CPU at 50%"                         │
│                                                          │
│  Current: 3 pods, avg CPU 80%  → scale UP to 5 pods      │
│  Current: 5 pods, avg CPU 30%  → scale DOWN to 3 pods    │
│                                                          │
│  ┌─────┐  ┌─────┐  ┌─────┐                               │
│  │Pod-1│  │Pod-2│  │Pod-3│  CPU avg = 80%                │
│  │ 85% │  │ 75% │  │ 80% │  → target is 50%              │
│  └─────┘  └─────┘  └─────┘  → need more pods!            │
│       │                                                  │
│       ▼ HPA scales to 5                                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                 │
│  │Pod-1│ │Pod-2│ │Pod-3│ │Pod-4│ │Pod-5│  CPU = 48%      │
│  │ 50% │ │ 45% │ │ 50% │ │ 48% │ │ 47% │  ← balanced     │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

```bash
# Create HPA (requires metrics-server)
kubectl autoscale deployment nginx-deploy \
  --cpu-percent=50 \
  --min=2 \
  --max=10

# Check HPA status
kubectl get hpa

# Declarative:
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nginx-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx-deploy
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

---

## 4.4 Production Checklist

```
┌──────────── Production Readiness Checklist ──────────────────┐
│                                                               │
│  □ Resource requests and limits set on every container       │
│  □ Liveness and readiness probes configured                  │
│  □ At least 2+ replicas for high availability                │
│  □ Pod Disruption Budget (PDB) set                           │
│  □ ConfigMaps for non-sensitive config                       │
│  □ Secrets for sensitive data (not hardcoded)                │
│  □ Namespace isolation per project/team                      │
│  □ RBAC: least-privilege ServiceAccounts                     │
│  □ Network Policies to restrict pod-to-pod traffic           │
│  □ Rolling update strategy configured                        │
│  □ Image tags are specific (not :latest)                     │
│  □ Non-root container user                                   │
│  □ Logging to stdout/stderr (not files)                      │
│  □ Monitoring (Prometheus + Grafana)                         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 4.5 Full Architecture Recap

```
┌──────────────────────────────────────────────────────────────────────┐
│                    COMPLETE K8s REQUEST FLOW                        │
│                                                                      │
│  1. You run: kubectl apply -f deployment.yaml                       │
│       │                                                              │
│       ▼                                                              │
│  2. kubectl → HTTPS → API Server                                    │
│       │                                                              │
│       ▼                                                              │
│  3. API Server validates YAML → stores in etcd                      │
│       │                                                              │
│       ▼                                                              │
│  4. Deployment Controller (in controller-manager) sees new object   │
│     → creates ReplicaSet                                            │
│       │                                                              │
│       ▼                                                              │
│  5. ReplicaSet Controller creates Pod objects (in etcd)              │
│     (Pods are "Pending" — no node assigned yet)                     │
│       │                                                              │
│       ▼                                                              │
│  6. Scheduler watches for unassigned Pods                           │
│     → picks best node → updates pod.spec.nodeName                   │
│       │                                                              │
│       ▼                                                              │
│  7. kubelet on that node sees "my pod got assigned here"            │
│     → calls containerd via CRI                                      │
│       │                                                              │
│       ▼                                                              │
│  8. containerd pulls image → creates sandbox → starts container     │
│       │                                                              │
│       ▼                                                              │
│  9. Pod is Running! kubelet reports status back to API Server       │
│       │                                                              │
│       ▼                                                              │
│  10. kube-proxy updates iptables rules for any Services             │
│      that select this Pod                                           │
│                                                                      │
│  Total time: typically 2-10 seconds                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4.6 What's Next?

Now that you understand the concepts, it's time to deploy real applications!

- **📄 12-project1-python-guide.md** — Deploy the Python Flask + HTML/CSS/JS stack
- **📄 13-project2-java-react-guide.md** — Deploy the React + Spring Boot stack

Both guides provide **exact copy-paste commands** for KillerCoda.

---

